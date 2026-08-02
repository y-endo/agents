#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { inflateSync } from "node:zlib";

const minimumNodeMajor = 22;
const method = "figma-codegen-compare-images@1";
const pixelDifferenceTolerance = 8;
const maximumPixelDiffRatio = 0.03;
const maximumNormalizedRmse = 0.08;

function assertSupportedRuntime() {
  const runtimeVersion = process.versions.node;
  const major = Number.parseInt(runtimeVersion.split(".", 1)[0] ?? "", 10);
  if (!Number.isInteger(major) || major < minimumNodeMajor) {
    throw new Error(
      `Unsupported Node.js v${runtimeVersion}. Node.js ${minimumNodeMajor} or later is required.`
    );
  }
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--source", "--implementation"].includes(flag) || !value) {
      throw new Error("Usage: compare-images.mjs --source <figma.png> --implementation <implementation.png>");
    }
    values.set(flag, value);
  }
  if (values.size !== 2 || !values.has("--source") || !values.has("--implementation")) {
    throw new Error("Usage: compare-images.mjs --source <figma.png> --implementation <implementation.png>");
  }
  return {
    sourcePath: values.get("--source"),
    implementationPath: values.get("--implementation"),
  };
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function decodePng(buffer, label) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error(`${label} is not a PNG file`);
  }

  let offset = 8;
  let header;
  const compressed = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) throw new Error(`${label} contains a truncated PNG chunk`);
    const data = buffer.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      if (length !== 13) throw new Error(`${label} has an invalid IHDR chunk`);
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      compressed.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }

  if (!header || compressed.length === 0) throw new Error(`${label} is missing PNG image data`);
  if (header.width <= 0 || header.height <= 0) throw new Error(`${label} has invalid dimensions`);
  if (
    header.bitDepth !== 8 ||
    ![0, 2, 4, 6].includes(header.colorType) ||
    header.compression !== 0 ||
    header.filter !== 0 ||
    header.interlace !== 0
  ) {
    throw new Error(`${label} must be a non-interlaced 8-bit grayscale, RGB, grayscale-alpha, or RGBA PNG`);
  }

  const channelsByColorType = new Map([[0, 1], [2, 3], [4, 2], [6, 4]]);
  const channels = channelsByColorType.get(header.colorType);
  const rowBytes = header.width * channels;
  const inflated = inflateSync(Buffer.concat(compressed));
  const expectedLength = (rowBytes + 1) * header.height;
  if (inflated.length !== expectedLength) throw new Error(`${label} has unexpected decoded data length`);

  const decoded = Buffer.alloc(rowBytes * header.height);
  let inputOffset = 0;
  for (let row = 0; row < header.height; row += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;
    if (filterType > 4) throw new Error(`${label} uses an unsupported PNG filter`);
    const rowOffset = row * rowBytes;
    for (let column = 0; column < rowBytes; column += 1) {
      const raw = inflated[inputOffset + column];
      const left = column >= channels ? decoded[rowOffset + column - channels] : 0;
      const above = row > 0 ? decoded[rowOffset - rowBytes + column] : 0;
      const upperLeft = row > 0 && column >= channels
        ? decoded[rowOffset - rowBytes + column - channels]
        : 0;
      let value = raw;
      if (filterType === 1) value += left;
      if (filterType === 2) value += above;
      if (filterType === 3) value += Math.floor((left + above) / 2);
      if (filterType === 4) value += paeth(left, above, upperLeft);
      decoded[rowOffset + column] = value & 0xff;
    }
    inputOffset += rowBytes;
  }

  const rgba = Buffer.alloc(header.width * header.height * 4);
  for (let pixel = 0; pixel < header.width * header.height; pixel += 1) {
    const input = pixel * channels;
    const output = pixel * 4;
    if (header.colorType === 0) {
      rgba[output] = decoded[input];
      rgba[output + 1] = decoded[input];
      rgba[output + 2] = decoded[input];
      rgba[output + 3] = 255;
    } else if (header.colorType === 2) {
      rgba[output] = decoded[input];
      rgba[output + 1] = decoded[input + 1];
      rgba[output + 2] = decoded[input + 2];
      rgba[output + 3] = 255;
    } else if (header.colorType === 4) {
      rgba[output] = decoded[input];
      rgba[output + 1] = decoded[input];
      rgba[output + 2] = decoded[input];
      rgba[output + 3] = decoded[input + 1];
    } else {
      decoded.copy(rgba, output, input, input + 4);
    }
  }

  return { width: header.width, height: header.height, rgba };
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function compare(source, implementation) {
  if (source.width !== implementation.width || source.height !== implementation.height) {
    throw new Error(
      `Image dimensions must match exactly: source ${source.width}x${source.height}, ` +
      `implementation ${implementation.width}x${implementation.height}`
    );
  }

  const pixelCount = source.width * source.height;
  let changedPixels = 0;
  let squaredError = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    let changed = false;
    for (let channel = 0; channel < 4; channel += 1) {
      const index = pixel * 4 + channel;
      const difference = Math.abs(source.rgba[index] - implementation.rgba[index]);
      squaredError += difference * difference;
      if (difference > pixelDifferenceTolerance) changed = true;
    }
    if (changed) changedPixels += 1;
  }

  return {
    pixelDiffRatio: changedPixels / pixelCount,
    normalizedRmse: Math.sqrt(squaredError / (pixelCount * 4)) / 255,
  };
}

try {
  assertSupportedRuntime();
  const { sourcePath, implementationPath } = parseArguments(process.argv.slice(2));
  const [sourceBuffer, implementationBuffer] = await Promise.all([
    readFile(sourcePath),
    readFile(implementationPath),
  ]);
  const source = decodePng(sourceBuffer, "source");
  const implementation = decodePng(implementationBuffer, "implementation");
  const metrics = compare(source, implementation);
  const result =
    metrics.pixelDiffRatio <= maximumPixelDiffRatio &&
    metrics.normalizedRmse <= maximumNormalizedRmse
      ? "pass"
      : "fail";
  process.stdout.write(`${JSON.stringify({
    method,
    comparedAt: new Date().toISOString(),
    source: {
      width: source.width,
      height: source.height,
      sha256: sha256(sourceBuffer),
    },
    implementation: {
      width: implementation.width,
      height: implementation.height,
      sha256: sha256(implementationBuffer),
    },
    metrics: {
      pixelDiffRatio: { value: metrics.pixelDiffRatio, maximum: maximumPixelDiffRatio },
      normalizedRmse: { value: metrics.normalizedRmse, maximum: maximumNormalizedRmse },
    },
    result,
  }, null, 2)}\n`);
  if (result !== "pass") process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Image comparison failed: ${error.message}\n`);
  process.exitCode = 1;
}
