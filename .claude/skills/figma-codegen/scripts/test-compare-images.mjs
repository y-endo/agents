#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const comparator = path.join(scriptDirectory, "compare-images.mjs");
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "figma-image-compare-test-"));

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) {
    current = (current & 1) === 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  }
  return current >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return result;
}

function png(width, height, changedPixels = 0) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let row = 0; row < height; row += 1) {
    rows[row * (width * 4 + 1)] = 0;
    for (let column = 0; column < width; column += 1) {
      const pixel = row * width + column;
      const offset = row * (width * 4 + 1) + 1 + column * 4;
      const value = pixel < changedPixels ? 255 : 0;
      rows[offset] = value;
      rows[offset + 1] = value;
      rows[offset + 2] = value;
      rows[offset + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function run(sourcePath, implementationPath) {
  return spawnSync(
    process.execPath,
    [comparator, "--source", sourcePath, "--implementation", implementationPath],
    { encoding: "utf8" }
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const sourcePath = path.join(temporaryDirectory, "source.png");
  const exactPath = path.join(temporaryDirectory, "exact.png");
  const smallDifferencePath = path.join(temporaryDirectory, "small-difference.png");
  const largeDifferencePath = path.join(temporaryDirectory, "large-difference.png");
  const wrongSizePath = path.join(temporaryDirectory, "wrong-size.png");
  await Promise.all([
    writeFile(sourcePath, png(20, 20)),
    writeFile(exactPath, png(20, 20)),
    writeFile(smallDifferencePath, png(20, 20, 1)),
    writeFile(largeDifferencePath, png(20, 20, 40)),
    writeFile(wrongSizePath, png(19, 20)),
  ]);

  const exact = run(sourcePath, exactPath);
  assert(exact.status === 0, `exact comparison failed\n${exact.stdout}${exact.stderr}`);
  const exactResult = JSON.parse(exact.stdout);
  assert(exactResult.result === "pass", "exact comparison must pass");
  assert(exactResult.method === "figma-codegen-compare-images@1", "method must be fixed");

  const smallDifference = run(sourcePath, smallDifferencePath);
  assert(
    smallDifference.status === 0 && JSON.parse(smallDifference.stdout).result === "pass",
    `small comparison failed\n${smallDifference.stdout}${smallDifference.stderr}`
  );

  const largeDifference = run(sourcePath, largeDifferencePath);
  assert(largeDifference.status === 1, "large visual difference must fail");
  assert(JSON.parse(largeDifference.stdout).result === "fail", "failed comparison must report fail");

  const wrongSize = run(sourcePath, wrongSizePath);
  assert(wrongSize.status === 1, "dimension mismatch must fail");
  assert(wrongSize.stderr.includes("dimensions must match exactly"), "dimension error must be explicit");

  console.log("Figma image comparator tests passed.");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
