#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDirectory, "..");

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} is required`);
  }
  return value;
}

function integerArg(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return parsed;
}

function checksumPayload(payload) {
  const text = JSON.stringify(payload);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    hash ^= codeUnit & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= codeUnit >>> 8;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function verifyIntegrity(payload, label) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.integrity?.algorithm !== "fnv1a32-utf16" ||
    typeof payload.integrity?.checksum !== "string"
  ) {
    throw new Error(`${label} has no supported payload checksum`);
  }
  const { integrity, ...body } = payload;
  if (checksumPayload(body) !== integrity.checksum) {
    throw new Error(`${label} payload checksum mismatch`);
  }
}

function replaceExactlyOnce(source, expected, replacement) {
  const parts = source.split(expected);
  if (parts.length !== 2) {
    throw new Error(`Expected exactly one placeholder: ${expected}`);
  }
  return `${parts[0]}${replacement}${parts[1]}`;
}

async function readSnippet(name) {
  return readFile(path.join(scriptDirectory, name), "utf8");
}

async function loadConfig(configPath) {
  const resolved = configPath
    ? path.resolve(process.cwd(), configPath)
    : path.join(skillRoot, "assets", "design-tokens.config.json");
  const config = await readJson(resolved);
  for (const field of [
    "maxBatchSize",
    "maxInventoryPayloadBytes",
    "maxPlanPayloadBytes",
    "maxPayloadBytes",
  ]) {
    if (!Number.isInteger(config.extraction?.[field])) {
      throw new Error(`config.extraction.${field} must be an integer`);
    }
  }
  return config;
}

function requireExternalOutput(outputPath) {
  const resolved = path.resolve(process.cwd(), requiredString(outputPath, "--output"));
  const relative = path.relative(process.cwd(), resolved);
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  ) {
    throw new Error("Prepared code must be written outside the target project");
  }
  return resolved;
}

async function writePreparedCode(outputPath, source) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, source, { encoding: "utf8", mode: 0o600 });
}

async function loadPageList(rawDirectory) {
  const pageListPath = path.join(rawDirectory, "page-list.json");
  const pageList = await readJson(pageListPath);
  verifyIntegrity(pageList, "page-list.json");
  if (
    pageList.schemaVersion !== 2 ||
    pageList.kind !== "figma-variable-page-list" ||
    !Array.isArray(pageList.pages) ||
    pageList.pageCount !== pageList.pages.length
  ) {
    throw new Error("page-list.json is inconsistent");
  }
  const ids = new Set();
  for (const [index, page] of pageList.pages.entries()) {
    if (
      page.index !== index ||
      typeof page.id !== "string" ||
      page.id.length === 0 ||
      typeof page.name !== "string" ||
      ids.has(page.id)
    ) {
      throw new Error(`Invalid or duplicate page-list entry at index ${index}`);
    }
    ids.add(page.id);
  }
  return pageList;
}

async function jsonFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(directory, entry.name));
}

async function loadPageEvidence(rawDirectory) {
  const pageList = await loadPageList(rawDirectory);
  const scanPaths = await jsonFiles(path.join(rawDirectory, "pages"));
  const scansById = new Map();
  const directVariableIds = new Set();
  const explicitCollectionIds = new Set();
  for (const scanPath of scanPaths) {
    const scan = await readJson(scanPath);
    verifyIntegrity(scan, path.relative(rawDirectory, scanPath));
    if (
      scan.schemaVersion !== 2 ||
      scan.kind !== "figma-variable-page-scan" ||
      scan.fileKey !== pageList.fileKey ||
      scan.fileName !== pageList.fileName ||
      !scan.page ||
      scansById.has(scan.page.id) ||
      !Array.isArray(scan.directVariableIds) ||
      !Array.isArray(scan.explicitVariableModeCollectionIds) ||
      !Array.isArray(scan.errors) ||
      scan.errors.length > 0
    ) {
      throw new Error(`Invalid page scan: ${path.relative(rawDirectory, scanPath)}`);
    }
    const expectedPage = pageList.pages[scan.page.index];
    if (
      !expectedPage ||
      expectedPage.id !== scan.page.id ||
      expectedPage.name !== scan.page.name
    ) {
      throw new Error(`Unexpected page scan: ${path.relative(rawDirectory, scanPath)}`);
    }
    if (
      JSON.stringify(scan.directVariableIds) !==
        JSON.stringify([...new Set(scan.directVariableIds)].sort()) ||
      JSON.stringify(scan.explicitVariableModeCollectionIds) !==
        JSON.stringify([...new Set(scan.explicitVariableModeCollectionIds)].sort()) ||
      scan.counts?.directVariables !== scan.directVariableIds.length ||
      scan.counts?.explicitVariableModeCollections !==
        scan.explicitVariableModeCollectionIds.length ||
      scan.counts?.errors !== 0
    ) {
      throw new Error(`Page scan manifest is inconsistent: ${path.relative(rawDirectory, scanPath)}`);
    }
    scansById.set(scan.page.id, scan);
    for (const id of scan.directVariableIds) directVariableIds.add(id);
    for (const id of scan.explicitVariableModeCollectionIds) explicitCollectionIds.add(id);
  }
  if (scansById.size !== pageList.pages.length) {
    throw new Error(
      `Page scan coverage is incomplete: ${scansById.size}/${pageList.pages.length}`
    );
  }
  const pageManifest = pageList.pages.map((page) => {
    const scan = scansById.get(page.id);
    return {
      index: page.index,
      id: page.id,
      name: page.name,
      scanChecksum: scan.integrity.checksum,
      counts: scan.counts,
    };
  });
  return {
    pageList,
    pageManifest,
    directVariableIds: [...directVariableIds].sort(),
    explicitVariableModeCollectionIds: [...explicitCollectionIds].sort(),
  };
}

async function loadInventory(rawDirectory, evidence, config) {
  const inventory = await readJson(path.join(rawDirectory, "inventory.json"));
  verifyIntegrity(inventory, "inventory.json");
  const orderedEvidence = evidence.pageManifest.map(({ counts, ...entry }) => entry);
  if (
    inventory.schemaVersion !== 2 ||
    inventory.kind !== "figma-variable-inventory" ||
    inventory.fileKey !== evidence.pageList.fileKey ||
    inventory.fileName !== evidence.pageList.fileName ||
    inventory.usage?.pageCount !== evidence.pageList.pageCount ||
    inventory.usage?.pageListChecksum !== evidence.pageList.integrity.checksum ||
    inventory.usage?.pageScansChecksum !== checksumPayload(orderedEvidence) ||
    inventory.usage?.directVariableCount !== evidence.directVariableIds.length ||
    inventory.usage?.directVariableIdsChecksum !==
      checksumPayload(evidence.directVariableIds) ||
    !Array.isArray(inventory.usage?.errors) ||
    inventory.usage.errors.length > 0 ||
    JSON.stringify(inventory.namingPreflight?.config) !== JSON.stringify(config.naming)
  ) {
    throw new Error("Inventory does not match the saved page evidence or configuration");
  }
  if (
    inventory.local.variableIds !== undefined &&
    (!Array.isArray(inventory.local.variableIds) ||
      inventory.local.variableIds.length !== inventory.local.variableCount ||
      new Set(inventory.local.variableIds).size !== inventory.local.variableIds.length ||
      inventory.local.variableIds.some(
        (variableId) => typeof variableId !== "string" || variableId.length === 0
      ) ||
      checksumPayload(inventory.local.variableIds) !==
        inventory.local.variableIdsChecksum)
  ) {
    throw new Error("Inventory embedded local Export plan is inconsistent");
  }
  if (
    Buffer.byteLength(JSON.stringify(inventory), "utf8") >
    config.extraction.maxInventoryPayloadBytes
  ) {
    throw new Error("Inventory exceeds the configured payload limit");
  }
  return inventory;
}

async function loadExportPlan(rawDirectory, inventory, config) {
  const planPaths = await jsonFiles(path.join(rawDirectory, "plans"));
  if (planPaths.length === 0) throw new Error("No saved Export-plan batches were found");
  const plans = [];
  for (const planPath of planPaths) {
    const plan = await readJson(planPath);
    verifyIntegrity(plan, path.relative(rawDirectory, planPath));
    if (
      plan.schemaVersion !== 2 ||
      plan.kind !== "figma-variable-export-plan" ||
      !Array.isArray(plan.variableIds) ||
      !Array.isArray(plan.groups) ||
      !plan.pagination
    ) {
      throw new Error(`Invalid Export-plan batch: ${path.relative(rawDirectory, planPath)}`);
    }
    plans.push(plan);
  }
  plans.sort((a, b) => a.pagination.startIndex - b.pagination.startIndex);
  const first = plans[0];
  const variableIds = [];
  let expectedStart = 0;
  for (const plan of plans) {
    if (
      plan.source?.fileKey !== inventory.fileKey ||
      plan.source?.usageChecksum !== inventory.usage.checksum ||
      plan.source?.directVariableIdsChecksum !==
        inventory.usage.directVariableIdsChecksum ||
      plan.source?.planChecksum !== first.source.planChecksum ||
      JSON.stringify(plan.groups) !== JSON.stringify(first.groups) ||
      plan.pagination.startIndex !== expectedStart ||
      plan.pagination.batchSize !== config.extraction.maxBatchSize ||
      plan.pagination.maxPayloadBytes !== config.extraction.maxPlanPayloadBytes ||
      plan.pagination.returnedCount !== plan.variableIds.length ||
      plan.pagination.batchIdentityChecksum !== checksumPayload(plan.variableIds)
    ) {
      throw new Error("Export-plan batches do not share one valid manifest");
    }
    variableIds.push(...plan.variableIds);
    expectedStart = plan.pagination.nextStartIndex;
  }
  if (
    plans.at(-1).pagination.hasMore ||
    expectedStart !== first.pagination.total ||
    checksumPayload(variableIds) !== first.source.planChecksum ||
    new Set(variableIds).size !== variableIds.length
  ) {
    throw new Error("Export plan is incomplete");
  }
  let groupStart = 0;
  for (const [index, group] of first.groups.entries()) {
    const expected = index === 0 ? inventory.local : inventory.libraryCollections[index - 1];
    const expectedType = index === 0 ? "local" : "library";
    const ids = variableIds.slice(group.startIndex, group.startIndex + group.variableCount);
    if (
      !expected ||
      group.type !== expectedType ||
      group.startIndex !== groupStart ||
      group.variableCount !== expected.variableCount ||
      group.variableIdsChecksum !== expected.variableIdsChecksum ||
      group.usageChecksum !== expected.usageChecksum ||
      checksumPayload(ids) !== group.variableIdsChecksum ||
      (index > 0 && group.key !== expected.key)
    ) {
      throw new Error(`Export-plan group ${index} does not match Inventory`);
    }
    groupStart += group.variableCount;
  }
  if (groupStart !== variableIds.length) {
    throw new Error("Export-plan groups do not cover the selected plan");
  }
  return { source: first.source, groups: first.groups, variableIds };
}

function inventoryUsageSummary(inventory) {
  return {
    checksum: inventory.usage.checksum,
    resolvedVariableCount: inventory.usage.resolvedVariableCount,
    resolvedVariableIdsChecksum: inventory.usage.resolvedVariableIdsChecksum,
    directVariableIdsChecksum: inventory.usage.directVariableIdsChecksum,
    directVariableCount: inventory.usage.directVariableCount,
  };
}

function localSummary(inventory) {
  return {
    variableCount: inventory.local.variableCount,
    variableIdsChecksum: inventory.local.variableIdsChecksum,
    usageChecksum: inventory.local.usageChecksum,
  };
}

function librarySummaries(inventory) {
  return inventory.libraryCollections.map((collection) => ({
    name: collection.name,
    key: collection.key,
    libraryName: collection.libraryName,
    variableCount: collection.variableCount,
    variableIdsChecksum: collection.variableIdsChecksum,
    usageChecksum: collection.usageChecksum,
  }));
}

const args = parseArgs(process.argv.slice(2));
const phase = requiredString(args.phase, "--phase");
const config = await loadConfig(args.config);
const rawDirectory = args["raw-dir"]
  ? path.resolve(process.cwd(), args["raw-dir"])
  : path.resolve(process.cwd(), config.inputDirectory);

function artifactPath(...segments) {
  return path.join(rawDirectory, ...segments);
}

function paddedIndex(index) {
  return String(index).padStart(4, "0");
}

if (phase === "self-check") {
  const snippets = [
    ["01-list-pages.js", ['const sourceFileKey = "__FILE_KEY__";']],
    [
      "02-scan-page.js",
      ['const sourceFileKey = "__FILE_KEY__";', "const targetPage = __TARGET_PAGE__;"],
    ],
    [
      "03-inventory.js",
      [
        'const sourceFileKey = "__FILE_KEY__";',
        'const injectedPageListChecksum = "__PAGE_LIST_CHECKSUM__";',
        "const injectedPageManifest = __PAGE_MANIFEST__;",
        "const injectedDirectVariableIds = __DIRECT_VARIABLE_IDS__;",
        "  __EXPLICIT_VARIABLE_MODE_COLLECTION_IDS__;",
        "const injectedNaming = __NAMING_CONFIG__;",
        "const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;",
      ],
    ],
    [
      "04-export-plan.js",
      [
        'const sourceFileKey = "__FILE_KEY__";',
        "const injectedDirectVariableIds = __DIRECT_VARIABLE_IDS__;",
        "const expectedUsage = __EXPECTED_USAGE__;",
        "const expectedLocal = __EXPECTED_LOCAL__;",
        "const expectedLibraryCollections = __EXPECTED_LIBRARY_COLLECTIONS__;",
        'const selectedScope = "__SELECTED_SCOPE__";',
        "const startIndex = __START_INDEX__;",
        "const batchSize = __BATCH_SIZE__;",
        "const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;",
      ],
    ],
    [
      "05-export-local.js",
      [
        'const sourceFileKey = "__FILE_KEY__";',
        "const injectedVariableIds = __VARIABLE_IDS__;",
        'const expectedVariableIdsChecksum = "__VARIABLE_IDS_CHECKSUM__";',
        'const expectedUsageChecksum = "__USAGE_CHECKSUM__";',
        'const expectedDirectVariableIdsChecksum = "__DIRECT_VARIABLE_IDS_CHECKSUM__";',
        "const startIndex = __START_INDEX__;",
        "const batchSize = __BATCH_SIZE__;",
        "const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;",
      ],
    ],
    [
      "06-export-library-collection.js",
      [
        'const sourceFileKey = "__FILE_KEY__";',
        "const injectedVariableIds = __VARIABLE_IDS__;",
        'const expectedVariableIdsChecksum = "__VARIABLE_IDS_CHECKSUM__";',
        'const expectedUsageChecksum = "__USAGE_CHECKSUM__";',
        'const expectedDirectVariableIdsChecksum = "__DIRECT_VARIABLE_IDS_CHECKSUM__";',
        'const collectionKey = "__COLLECTION_KEY__";',
        "const expectedLibraryName = __LIBRARY_NAME__;",
        "const startIndex = __START_INDEX__;",
        "const batchSize = __BATCH_SIZE__;",
        "const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;",
      ],
    ],
  ];
  const forbidden = [
    "loadAllPagesAsync",
    "importVariableByKeyAsync",
    "clientStorage",
    "figma.closePlugin",
  ];
  for (const [name, placeholders] of snippets) {
    const source = await readSnippet(name);
    for (const placeholder of placeholders) {
      if (source.split(placeholder).length !== 2) {
        throw new Error(`${name} must contain exactly one placeholder: ${placeholder}`);
      }
    }
    for (const banned of forbidden) {
      if (source.includes(banned)) {
        throw new Error(`${name} contains forbidden runtime API: ${banned}`);
      }
    }
    if (!source.includes("return ")) {
      throw new Error(`${name} must return its exact MCP payload`);
    }
  }
  console.log(
    JSON.stringify({
      phase,
      scriptCount: snippets.length,
      readOnly: true,
      configValidated: true,
    })
  );
  process.exit(0);
}

if (phase === "page-list") {
  const output = requireExternalOutput(args.output);
  const fileKey = requiredString(args["file-key"], "--file-key");
  let source = await readSnippet("01-list-pages.js");
  source = replaceExactlyOnce(
    source,
    'const sourceFileKey = "__FILE_KEY__";',
    `const sourceFileKey = ${JSON.stringify(fileKey)};`
  );
  await writePreparedCode(output, source);
  console.log(
    JSON.stringify({
      phase,
      output,
      artifactPath: artifactPath("page-list.json"),
    })
  );
  process.exit(0);
}

if (phase === "page-wave") {
  const outputDirectory = requireExternalOutput(
    path.join(requiredString(args["output-dir"], "--output-dir"), "placeholder.js")
  );
  const resolvedOutputDirectory = path.dirname(outputDirectory);
  const pageList = await loadPageList(rawDirectory);
  const startIndex = integerArg(args["start-index"] ?? "0", "--start-index", 0);
  const count = integerArg(args.count ?? "5", "--count", 1, 5);
  const pages = pageList.pages.slice(startIndex, startIndex + count);
  if (pages.length === 0) throw new Error("No pages remain in the requested wave");
  const outputs = [];
  for (const page of pages) {
    let source = await readSnippet("02-scan-page.js");
    source = replaceExactlyOnce(
      source,
      'const sourceFileKey = "__FILE_KEY__";',
      `const sourceFileKey = ${JSON.stringify(pageList.fileKey)};`
    );
    source = replaceExactlyOnce(
      source,
      "const targetPage = __TARGET_PAGE__;",
      `const targetPage = ${JSON.stringify(page)};`
    );
    const output = path.join(
      resolvedOutputDirectory,
      `page-${String(page.index).padStart(4, "0")}.js`
    );
    await writePreparedCode(output, source);
    outputs.push({
      pageIndex: page.index,
      output,
      artifactPath: artifactPath("pages", `page-${paddedIndex(page.index)}.json`),
    });
  }
  console.log(
    JSON.stringify({
      phase,
      outputs,
      callCount: outputs.length,
      execution: "parallel-tool-calls-required",
    })
  );
  process.exit(0);
}

const output = requireExternalOutput(args.output);
const evidence = await loadPageEvidence(rawDirectory);

if (phase === "inventory") {
  let source = await readSnippet("03-inventory.js");
  for (const [expected, replacement] of [
    [
      'const sourceFileKey = "__FILE_KEY__";',
      `const sourceFileKey = ${JSON.stringify(evidence.pageList.fileKey)};`,
    ],
    [
      'const injectedPageListChecksum = "__PAGE_LIST_CHECKSUM__";',
      `const injectedPageListChecksum = ${JSON.stringify(
        evidence.pageList.integrity.checksum
      )};`,
    ],
    [
      "const injectedPageManifest = __PAGE_MANIFEST__;",
      `const injectedPageManifest = ${JSON.stringify(evidence.pageManifest)};`,
    ],
    [
      "const injectedDirectVariableIds = __DIRECT_VARIABLE_IDS__;",
      `const injectedDirectVariableIds = ${JSON.stringify(
        evidence.directVariableIds
      )};`,
    ],
    [
      "  __EXPLICIT_VARIABLE_MODE_COLLECTION_IDS__;",
      `  ${JSON.stringify(evidence.explicitVariableModeCollectionIds)};`,
    ],
    [
      "const injectedNaming = __NAMING_CONFIG__;",
      `const injectedNaming = ${JSON.stringify(config.naming)};`,
    ],
    [
      "const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;",
      `const maxPayloadBytes = ${config.extraction.maxInventoryPayloadBytes};`,
    ],
  ]) {
    source = replaceExactlyOnce(source, expected, replacement);
  }
  await writePreparedCode(output, source);
  console.log(
    JSON.stringify({
      phase,
      output,
      artifactPath: artifactPath("inventory.json"),
      pageCount: evidence.pageList.pageCount,
      directVariableCount: evidence.directVariableIds.length,
    })
  );
  process.exit(0);
}

const inventory = await loadInventory(rawDirectory, evidence, config);

if (phase === "plan") {
  const scope = requiredString(args.scope, "--scope");
  if (scope !== "local-only" && scope !== "complete") {
    throw new Error("--scope must be local-only or complete");
  }
  const startIndex = integerArg(args["start-index"] ?? "0", "--start-index", 0);
  let source = await readSnippet("04-export-plan.js");
  for (const [expected, replacement] of [
    [
      'const sourceFileKey = "__FILE_KEY__";',
      `const sourceFileKey = ${JSON.stringify(inventory.fileKey)};`,
    ],
    [
      "const injectedDirectVariableIds = __DIRECT_VARIABLE_IDS__;",
      `const injectedDirectVariableIds = ${JSON.stringify(
        evidence.directVariableIds
      )};`,
    ],
    [
      "const expectedUsage = __EXPECTED_USAGE__;",
      `const expectedUsage = ${JSON.stringify(inventoryUsageSummary(inventory))};`,
    ],
    [
      "const expectedLocal = __EXPECTED_LOCAL__;",
      `const expectedLocal = ${JSON.stringify(localSummary(inventory))};`,
    ],
    [
      "const expectedLibraryCollections = __EXPECTED_LIBRARY_COLLECTIONS__;",
      `const expectedLibraryCollections = ${JSON.stringify(
        librarySummaries(inventory)
      )};`,
    ],
    [
      'const selectedScope = "__SELECTED_SCOPE__";',
      `const selectedScope = ${JSON.stringify(scope)};`,
    ],
    ["const startIndex = __START_INDEX__;", `const startIndex = ${startIndex};`],
    [
      "const batchSize = __BATCH_SIZE__;",
      `const batchSize = ${config.extraction.maxBatchSize};`,
    ],
    [
      "const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;",
      `const maxPayloadBytes = ${config.extraction.maxPlanPayloadBytes};`,
    ],
  ]) {
    source = replaceExactlyOnce(source, expected, replacement);
  }
  await writePreparedCode(output, source);
  console.log(
    JSON.stringify({
      phase,
      output,
      artifactPath: artifactPath("plans", `batch-${paddedIndex(startIndex)}.json`),
      scope,
      startIndex,
    })
  );
  process.exit(0);
}

if (phase === "local") {
  const startIndex = integerArg(args["start-index"] ?? "0", "--start-index", 0);
  let variableIds;
  let planSource;
  let scope;
  const savedPlanPaths = await jsonFiles(path.join(rawDirectory, "plans"));
  if (savedPlanPaths.length > 0) {
    const plan = await loadExportPlan(rawDirectory, inventory, config);
    const group = plan.groups[0];
    variableIds = plan.variableIds.slice(
      group.startIndex,
      group.startIndex + group.variableCount
    );
    planSource = "export-plan";
    scope = plan.source.scope;
  } else if (Array.isArray(inventory.local.variableIds)) {
    variableIds = inventory.local.variableIds;
    planSource = "inventory";
    scope = "local-only";
  } else {
    throw new Error(
      "Inventory has no embedded local Export plan; prepare the fallback Export plan"
    );
  }
  let source = await readSnippet("05-export-local.js");
  for (const [expected, replacement] of [
    [
      'const sourceFileKey = "__FILE_KEY__";',
      `const sourceFileKey = ${JSON.stringify(inventory.fileKey)};`,
    ],
    [
      "const injectedVariableIds = __VARIABLE_IDS__;",
      `const injectedVariableIds = ${JSON.stringify(variableIds)};`,
    ],
    [
      'const expectedVariableIdsChecksum = "__VARIABLE_IDS_CHECKSUM__";',
      `const expectedVariableIdsChecksum = ${JSON.stringify(
        inventory.local.variableIdsChecksum
      )};`,
    ],
    [
      'const expectedUsageChecksum = "__USAGE_CHECKSUM__";',
      `const expectedUsageChecksum = ${JSON.stringify(
        inventory.local.usageChecksum
      )};`,
    ],
    [
      'const expectedDirectVariableIdsChecksum = "__DIRECT_VARIABLE_IDS_CHECKSUM__";',
      `const expectedDirectVariableIdsChecksum = ${JSON.stringify(
        inventory.usage.directVariableIdsChecksum
      )};`,
    ],
    ["const startIndex = __START_INDEX__;", `const startIndex = ${startIndex};`],
    [
      "const batchSize = __BATCH_SIZE__;",
      `const batchSize = ${config.extraction.maxBatchSize};`,
    ],
    [
      "const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;",
      `const maxPayloadBytes = ${config.extraction.maxPayloadBytes};`,
    ],
  ]) {
    source = replaceExactlyOnce(source, expected, replacement);
  }
  await writePreparedCode(output, source);
  console.log(
    JSON.stringify({
      phase,
      output,
      artifactPath: artifactPath("local", `batch-${paddedIndex(startIndex)}.json`),
      scope,
      planSource,
      startIndex,
      plannedCount: variableIds.length,
    })
  );
  process.exit(0);
}

if (phase === "library") {
  const plan = await loadExportPlan(rawDirectory, inventory, config);
  if (plan.source.scope !== "complete") {
    throw new Error("Library code requires a complete Export plan");
  }
  const collectionIndex = integerArg(
    requiredString(args["collection-index"], "--collection-index"),
    "--collection-index",
    0,
    inventory.libraryCollections.length - 1
  );
  const startIndex = integerArg(args["start-index"] ?? "0", "--start-index", 0);
  const expectedCollection = inventory.libraryCollections[collectionIndex];
  const group = plan.groups[collectionIndex + 1];
  if (!group || group.key !== expectedCollection.key) {
    throw new Error("Export-plan Library group does not match Inventory");
  }
  const variableIds = plan.variableIds.slice(
    group.startIndex,
    group.startIndex + group.variableCount
  );
  let source = await readSnippet("06-export-library-collection.js");
  for (const [expected, replacement] of [
    [
      'const sourceFileKey = "__FILE_KEY__";',
      `const sourceFileKey = ${JSON.stringify(inventory.fileKey)};`,
    ],
    [
      "const injectedVariableIds = __VARIABLE_IDS__;",
      `const injectedVariableIds = ${JSON.stringify(variableIds)};`,
    ],
    [
      'const expectedVariableIdsChecksum = "__VARIABLE_IDS_CHECKSUM__";',
      `const expectedVariableIdsChecksum = ${JSON.stringify(
        expectedCollection.variableIdsChecksum
      )};`,
    ],
    [
      'const expectedUsageChecksum = "__USAGE_CHECKSUM__";',
      `const expectedUsageChecksum = ${JSON.stringify(
        expectedCollection.usageChecksum
      )};`,
    ],
    [
      'const expectedDirectVariableIdsChecksum = "__DIRECT_VARIABLE_IDS_CHECKSUM__";',
      `const expectedDirectVariableIdsChecksum = ${JSON.stringify(
        inventory.usage.directVariableIdsChecksum
      )};`,
    ],
    [
      'const collectionKey = "__COLLECTION_KEY__";',
      `const collectionKey = ${JSON.stringify(expectedCollection.key)};`,
    ],
    [
      "const expectedLibraryName = __LIBRARY_NAME__;",
      `const expectedLibraryName = ${JSON.stringify(
        expectedCollection.libraryName
      )};`,
    ],
    ["const startIndex = __START_INDEX__;", `const startIndex = ${startIndex};`],
    [
      "const batchSize = __BATCH_SIZE__;",
      `const batchSize = ${config.extraction.maxBatchSize};`,
    ],
    [
      "const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;",
      `const maxPayloadBytes = ${config.extraction.maxPayloadBytes};`,
    ],
  ]) {
    source = replaceExactlyOnce(source, expected, replacement);
  }
  await writePreparedCode(output, source);
  console.log(
    JSON.stringify({
      phase,
      output,
      artifactPath: artifactPath(
        "libraries",
        `collection-${paddedIndex(collectionIndex)}`,
        `batch-${paddedIndex(startIndex)}.json`
      ),
      scope: plan.source.scope,
      collectionIndex,
      startIndex,
      plannedCount: variableIds.length,
    })
  );
  process.exit(0);
}

throw new Error(`Unsupported --phase: ${phase}`);
