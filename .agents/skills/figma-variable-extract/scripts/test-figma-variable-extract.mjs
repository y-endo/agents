import { access, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(skillRoot, "../../..");
const generator = path.join(skillRoot, "scripts", "generate-design-tokens.mjs");
const preparer = path.join(skillRoot, "scripts", "prepare-use-figma-code.mjs");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const skillInstructions = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
const japaneseSkillInstructions = await readFile(
  path.join(skillRoot, "SKILL.ja.md"),
  "utf8"
);
const defaultConfig = JSON.parse(
  await readFile(
    path.join(skillRoot, "assets", "design-tokens.config.json"),
    "utf8"
  )
);
for (const requiredInstruction of [
  "Apply this **hard gate** to every workflow that will validate or generate CSS",
  "There is no default.",
  "used Variables plus their transitive alias dependencies",
  "never calls `importVariableByKeyAsync`",
  "Never call `loadAllPagesAsync`",
  "at most once per `use_figma` call",
  "predicted CSS-name-collision counts for both scopes",
  "config.extraction.maxPayloadBytes",
  "size-bounded Export plan",
  "Export-plan",
  "prepare-use-figma-code.mjs",
  "--phase self-check",
  "exactly the reported number",
  "local-only fast path",
  "inventory.local.usageChecksum",
  "exact absolute `artifactPath`",
  "confidential provenance",
  "Treat the entire response from an identity or connection probe such as `whoami` as confidential.",
  "email, handle, user name, account plan, seat or license type, organization membership",
  "Official Figma Remote MCP connection verified.",
]) {
  if (!skillInstructions.includes(requiredInstruction)) {
    throw new Error(`SKILL.md is missing the usage contract: ${requiredInstruction}`);
  }
}
for (const requiredInstruction of [
  "`whoami`などのIdentity確認または接続確認が返す内容全体を機密情報として扱う。",
  "メールアドレス、ハンドル、ユーザー名、アカウントプラン、SeatまたはLicense種別、組織所属、rawレスポンスを繰り返さない。",
  "Figma公式Remote MCPへの接続を確認した。",
]) {
  if (!japaneseSkillInstructions.includes(requiredInstruction)) {
    throw new Error(
      `SKILL.ja.md is missing the confidential identity contract: ${requiredInstruction}`
    );
  }
}

const snippetNames = [
  "01-list-pages.js",
  "02-scan-page.js",
  "03-inventory.js",
  "04-export-plan.js",
  "05-export-local.js",
  "06-export-library-collection.js",
];
for (const scriptName of snippetNames) {
  const source = await readFile(path.join(skillRoot, "scripts", scriptName), "utf8");
  if (source.includes("loadAllPagesAsync")) {
    throw new Error(`${scriptName} uses unsupported loadAllPagesAsync`);
  }
  if (source.includes("importVariableByKeyAsync")) {
    throw new Error(`${scriptName} mutates Figma through importVariableByKeyAsync`);
  }
  if (source.includes("getVariablesInLibraryCollectionAsync")) {
    throw new Error(`${scriptName} enumerates every Variable in an enabled Library`);
  }
  if (source.includes("getLocalVariablesAsync")) {
    throw new Error(`${scriptName} enumerates every local Variable definition`);
  }
}

function replaceExactlyOnce(source, expected, replacement) {
  const parts = source.split(expected);
  if (parts.length !== 2) {
    throw new Error(`Expected exactly one placeholder: ${expected}`);
  }
  return `${parts[0]}${replacement}${parts[1]}`;
}

const fanOutPageList = {
  schemaVersion: 2,
  kind: "figma-variable-page-list",
  generatedAt: "2026-08-02T00:00:00.000Z",
  editorType: "figma",
  fileKey: "synthetic-file-key",
  fileName: "Document",
  pageCount: 60,
  pages: Array.from({ length: 60 }, (_, index) => ({
    index,
    id: `page-${String(index).padStart(3, "0")}`,
    name: `Synthetic page ${String(index).padStart(3, "0")}`,
  })),
  integrity: { algorithm: "fnv1a32-utf16", checksum: "00000000" },
};
const fanOutPageManifest = fanOutPageList.pages.map((page) => ({
  ...page,
  scanChecksum: `checksum-${String(page.index).padStart(3, "0")}`,
  counts: {
    nodes: 100,
    nodesWithBindings: 20,
    referencedStyles: 5,
    referencedStylesWithBindings: 4,
    directVariables: 20,
    explicitVariableModeCollections: 2,
    errors: 0,
  },
}));
const fanOutDirectVariableIds = Array.from(
  { length: 250 },
  (_, index) => `VariableID:${String(index).padStart(36, "0")}`
);
let fanOutInventorySource = await readFile(
  path.join(skillRoot, "scripts", "03-inventory.js"),
  "utf8"
);
for (const [expected, replacement] of [
  ['const sourceFileKey = "__FILE_KEY__";', 'const sourceFileKey = "synthetic-file-key";'],
  ['const injectedPageListChecksum = "__PAGE_LIST_CHECKSUM__";', `const injectedPageListChecksum = ${JSON.stringify(fanOutPageList.integrity.checksum)};`],
  ["const injectedPageManifest = __PAGE_MANIFEST__;", `const injectedPageManifest = ${JSON.stringify(fanOutPageManifest)};`],
  ["const injectedDirectVariableIds = __DIRECT_VARIABLE_IDS__;", `const injectedDirectVariableIds = ${JSON.stringify(fanOutDirectVariableIds)};`],
  ["  __EXPLICIT_VARIABLE_MODE_COLLECTION_IDS__;", '  ["collection-a","collection-b"];'],
  ["const injectedNaming = __NAMING_CONFIG__;", `const injectedNaming = ${JSON.stringify(defaultConfig.naming)};`],
  ["const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;", `const maxPayloadBytes = ${defaultConfig.extraction.maxInventoryPayloadBytes};`],
]) {
  fanOutInventorySource = replaceExactlyOnce(
    fanOutInventorySource,
    expected,
    replacement
  );
}
if (fanOutInventorySource.length > 50_000) {
  throw new Error(
    `60-page fan-out inventory exceeds the use_figma code limit: ${fanOutInventorySource.length}`
  );
}

async function runSnippet(name, figma, replacements) {
  let source = await readFile(path.join(skillRoot, "scripts", name), "utf8");
  for (const [expected, replacement] of replacements) {
    source = replaceExactlyOnce(source, expected, replacement);
  }
  return new AsyncFunction("figma", source)(figma);
}

function runGenerator(cwd, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [generator, ...args], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== expectedStatus) {
    throw new Error(
      `Generator status ${result.status}, expected ${expectedStatus}\n` +
        `${result.stdout}${result.stderr}`
    );
  }
  return result;
}

function runPreparer(cwd, args, forbiddenValues = []) {
  const result = spawnSync(process.execPath, [preparer, ...args], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Preparer failed\n${result.stdout}${result.stderr}`);
  }
  if (forbiddenValues.some((value) => value && result.stdout.includes(value))) {
    throw new Error("Preparer stdout exposed injected provenance or Variable IDs");
  }
  return JSON.parse(result.stdout);
}

const preparerSelfCheck = runPreparer(repositoryRoot, ["--phase", "self-check"]);
if (
  preparerSelfCheck.scriptCount !== 6 ||
  preparerSelfCheck.readOnly !== true ||
  preparerSelfCheck.configValidated !== true
) {
  throw new Error("Preparer self-check did not validate the canonical runtime bundle");
}

function expectGeneratorFailure(args, expectedMessage) {
  const result = runGenerator(repositoryRoot, args, 1);
  if (!result.stderr.includes(expectedMessage)) {
    throw new Error(
      `Expected generator error containing ${JSON.stringify(expectedMessage)}\n` +
        result.stderr
    );
  }
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

function resignPayload(value) {
  const { integrity: _integrity, ...payload } = value;
  value.integrity = {
    algorithm: "fnv1a32-utf16",
    checksum: checksumPayload(payload),
  };
  return value;
}

expectGeneratorFailure(["--input", "--validate-only"], "--input requires a value");
expectGeneratorFailure(
  ["--dry-run", "--validate-only"],
  "--dry-run and --validate-only are mutually exclusive"
);
expectGeneratorFailure(
  ["--check-runtime", "--local-only"],
  "--check-runtime cannot be combined with other options"
);
expectGeneratorFailure(["--unknown"], "Unknown argument: --unknown");

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function requireArtifactPath(actual, expected, label) {
  if (!path.isAbsolute(actual) || actual !== expected) {
    throw new Error(
      `${label} did not return its exact absolute artifactPath: ${actual} !== ${expected}`
    );
  }
}

const fileKey = "fixtureFileKey";
const modes = [
  { modeId: "light", name: "Light" },
  { modeId: "dark", name: "Dark" },
];
const localCollection = {
  id: "local-collection-id",
  key: "local-collection-key",
  name: "Semantic",
  remote: false,
  hiddenFromPublishing: false,
  defaultModeId: "light",
  modes,
  variableIds: ["local-used-1", "local-used-2", "local-unused"],
};
const remoteCollection = {
  id: "remote-collection-id",
  key: "remote-collection-key",
  name: "Component",
  remote: true,
  hiddenFromPublishing: false,
  defaultModeId: "light",
  modes,
  variableIds: ["remote-direct", "remote-alias-target"],
};
const localVariables = [
  {
    id: "local-used-1",
    key: "local-used-key-1",
    name: "color/text",
    description: "",
    resolvedType: "COLOR",
    remote: false,
    variableCollectionId: localCollection.id,
    scopes: [],
    codeSyntax: { WEB: "var(--color-text)" },
    hiddenFromPublishing: false,
    valuesByMode: {
      light: { r: 0, g: 0, b: 0, a: 1 },
      dark: { r: 1, g: 1, b: 1, a: 1 },
    },
  },
  {
    id: "local-used-2",
    key: "local-used-key-2",
    name: "color/background",
    description: "",
    resolvedType: "COLOR",
    remote: false,
    variableCollectionId: localCollection.id,
    scopes: [],
    codeSyntax: { WEB: "Color/Background" },
    hiddenFromPublishing: false,
    valuesByMode: {
      light: { r: 1, g: 1, b: 1, a: 1 },
      dark: { r: 0, g: 0, b: 0, a: 1 },
    },
  },
  {
    id: "local-unused",
    key: "local-unused-key",
    name: "color/unused-local-definition",
    description: "",
    resolvedType: "COLOR",
    remote: false,
    variableCollectionId: localCollection.id,
    scopes: [],
    codeSyntax: { WEB: "var(--color-unused-local)" },
    hiddenFromPublishing: false,
    valuesByMode: {
      light: { r: 1, g: 0, b: 0, a: 1 },
      dark: { r: 1, g: 0, b: 0, a: 1 },
    },
  },
];
const remoteVariables = [
  {
    id: "remote-direct",
    key: "remote-direct-key",
    name: "color/library",
    description: "",
    resolvedType: "COLOR",
    remote: true,
    variableCollectionId: remoteCollection.id,
    scopes: [],
    codeSyntax: { WEB: "var(--color-library)" },
    hiddenFromPublishing: false,
    valuesByMode: {
      light: { type: "VARIABLE_ALIAS", id: "remote-alias-target" },
      dark: { type: "VARIABLE_ALIAS", id: "remote-alias-target" },
    },
  },
  {
    id: "remote-alias-target",
    key: "remote-alias-target-key",
    name: "color/primitive",
    description: "",
    resolvedType: "COLOR",
    remote: true,
    variableCollectionId: remoteCollection.id,
    scopes: [],
    codeSyntax: { WEB: "var(--color-primitive)" },
    hiddenFromPublishing: false,
    valuesByMode: {
      light: { r: 0.2, g: 0.3, b: 0.4, a: 1 },
      dark: { r: 0.2, g: 0.3, b: 0.4, a: 1 },
    },
  },
];
const enabledUsedCollection = {
  key: remoteCollection.key,
  name: remoteCollection.name,
  libraryName: "Fixture Library",
};
const enabledUnusedCollection = {
  key: "unused-enterprise-library-collection-key",
  name: "Primitives",
  libraryName: "Unused Enterprise Design Library",
};
const variablesById = new Map(
  [...localVariables, ...remoteVariables].map((variable) => [variable.id, variable])
);
const collectionsById = new Map([
  [localCollection.id, localCollection],
  [remoteCollection.id, remoteCollection],
]);
const referencedStyle = {
  id: "referenced-style-id",
  boundVariables: {
    color: { type: "VARIABLE_ALIAS", id: "local-used-2" },
  },
};
const throwingTextNode = {
  type: "TEXT",
  boundVariables: {
    fills: [{ type: "VARIABLE_ALIAS", id: "local-used-1" }],
  },
  fillStyleId: referencedStyle.id,
};
Object.defineProperty(throwingTextNode, "gridStyleId", {
  get() {
    throw new TypeError("node.gridStyleId: no such property 'gridStyleId' on TEXT node");
  },
});
Object.defineProperty(throwingTextNode, "explicitVariableModes", {
  get() {
    throw new TypeError("node.explicitVariableModes: unsupported on TEXT node");
  },
});
const frameNode = {
  type: "FRAME",
  boundVariables: {
    strokes: [{ type: "VARIABLE_ALIAS", id: "remote-direct" }],
  },
  explicitVariableModes: { [remoteCollection.id]: "light" },
};
const duplicateRemoteNode = {
  type: "RECTANGLE",
  boundVariables: {
    fills: [{ type: "VARIABLE_ALIAS", id: "remote-direct" }],
  },
};
const pages = [
  {
    type: "PAGE",
    id: "page-1",
    name: "Cover",
    findAll: () => [throwingTextNode, frameNode],
  },
  {
    type: "PAGE",
    id: "page-2",
    name: "Components",
    findAll: () => [duplicateRemoteNode],
  },
];
const pagesById = new Map(pages.map((page) => [page.id, page]));
let importCallCount = 0;
let variableResolveCallCount = 0;
let collectionResolveCallCount = 0;
let libraryVariableEnumerationCallCount = 0;
let localVariableEnumerationCallCount = 0;
const pageSwitches = [];
const baseFigma = {
  editorType: "figma",
  fileKey,
  root: {
    name: "Document",
    children: pages,
  },
  getNodeByIdAsync: async (id) => pagesById.get(id) ?? null,
  setCurrentPageAsync: async (page) => {
    pageSwitches.push(page.id);
  },
  getStyleByIdAsync: async (id) =>
    id === referencedStyle.id ? referencedStyle : null,
  variables: {
    getLocalVariableCollectionsAsync: async () => [localCollection],
    getLocalVariablesAsync: async () => {
      localVariableEnumerationCallCount += 1;
      return localVariables;
    },
    getVariableByIdAsync: async (id) => {
      variableResolveCallCount += 1;
      return variablesById.get(id) ?? null;
    },
    getVariableCollectionByIdAsync: async (id) => {
      collectionResolveCallCount += 1;
      return collectionsById.get(id) ?? null;
    },
    importVariableByKeyAsync: async () => {
      importCallCount += 1;
      throw new Error("importVariableByKeyAsync must not be called");
    },
  },
  teamLibrary: {
    getAvailableLibraryVariableCollectionsAsync: async () => [
      enabledUsedCollection,
      enabledUnusedCollection,
    ],
    getVariablesInLibraryCollectionAsync: async (key) => {
      libraryVariableEnumerationCallCount += 1;
      if (key === enabledUsedCollection.key) {
        return remoteVariables.map(({ key: variableKey, name, resolvedType }) => ({
          key: variableKey,
          name,
          resolvedType,
        }));
      }
      return Array.from({ length: 142 }, (_, index) => ({
        key: `unused-enterprise-library-variable-${index}`,
        name: `unused/${index}`,
        resolvedType: "COLOR",
      }));
    },
  },
};

const temporaryRoot = await realpath(
  await mkdtemp(path.join(os.tmpdir(), "figma-variable-extract-test-"))
);
const preparedCodeRoot = await mkdtemp(
  path.join(os.tmpdir(), "figma-variable-extract-prepared-code-")
);
try {
  const pageList = await runSnippet("01-list-pages.js", baseFigma, [
    ['const sourceFileKey = "__FILE_KEY__";', `const sourceFileKey = ${JSON.stringify(fileKey)};`],
  ]);
  const pageScans = [];
  for (const page of pageList.pages) {
    pageScans.push(
      await runSnippet("02-scan-page.js", baseFigma, [
        ['const sourceFileKey = "__FILE_KEY__";', `const sourceFileKey = ${JSON.stringify(fileKey)};`],
        ["const targetPage = __TARGET_PAGE__;", `const targetPage = ${JSON.stringify(page)};`],
      ])
    );
  }
  if (
    pageSwitches.length !== pages.length ||
    pageSwitches.some((pageId, index) => pageId !== pages[index].id)
  ) {
    throw new Error("Page scan did not switch exactly once to each target page");
  }

  const pageManifest = pageScans.map((scan) => ({
    index: scan.page.index,
    id: scan.page.id,
    name: scan.page.name,
    scanChecksum: scan.integrity.checksum,
    counts: scan.counts,
  }));
  const scannedDirectIds = [
    ...new Set(pageScans.flatMap((scan) => scan.directVariableIds)),
  ].sort();
  const scannedExplicitModeCollectionIds = [
    ...new Set(
      pageScans.flatMap((scan) => scan.explicitVariableModeCollectionIds)
    ),
  ].sort();

  async function runInventory(figma, naming = defaultConfig.naming) {
    return runSnippet("03-inventory.js", figma, [
      ['const sourceFileKey = "__FILE_KEY__";', `const sourceFileKey = ${JSON.stringify(fileKey)};`],
      ['const injectedPageListChecksum = "__PAGE_LIST_CHECKSUM__";', `const injectedPageListChecksum = ${JSON.stringify(pageList.integrity.checksum)};`],
      ["const injectedPageManifest = __PAGE_MANIFEST__;", `const injectedPageManifest = ${JSON.stringify(pageManifest)};`],
      ["const injectedDirectVariableIds = __DIRECT_VARIABLE_IDS__;", `const injectedDirectVariableIds = ${JSON.stringify(scannedDirectIds)};`],
      ["  __EXPLICIT_VARIABLE_MODE_COLLECTION_IDS__;", `  ${JSON.stringify(scannedExplicitModeCollectionIds)};`],
      ["const injectedNaming = __NAMING_CONFIG__;", `const injectedNaming = ${JSON.stringify(naming)};`],
      ["const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;", `const maxPayloadBytes = ${defaultConfig.extraction.maxInventoryPayloadBytes};`],
    ]);
  }
  const inventory = await runInventory(baseFigma);
  const directIds = scannedDirectIds;
  const directIdsChecksum = inventory.usage.directVariableIdsChecksum;
  async function runExportPlan(
    figma,
    scope = "complete",
    startIndex = 0,
    batchSize = defaultConfig.extraction.maxBatchSize,
    maxPayloadBytes = defaultConfig.extraction.maxPlanPayloadBytes
  ) {
    return runSnippet("04-export-plan.js", figma, [
      ['const sourceFileKey = "__FILE_KEY__";', `const sourceFileKey = ${JSON.stringify(fileKey)};`],
      ["const injectedDirectVariableIds = __DIRECT_VARIABLE_IDS__;", `const injectedDirectVariableIds = ${JSON.stringify(directIds)};`],
      ["const expectedUsage = __EXPECTED_USAGE__;", `const expectedUsage = ${JSON.stringify({
        checksum: inventory.usage.checksum,
        resolvedVariableCount: inventory.usage.resolvedVariableCount,
        resolvedVariableIdsChecksum: inventory.usage.resolvedVariableIdsChecksum,
        directVariableIdsChecksum: inventory.usage.directVariableIdsChecksum,
        directVariableCount: inventory.usage.directVariableCount,
      })};`],
      ["const expectedLocal = __EXPECTED_LOCAL__;", `const expectedLocal = ${JSON.stringify(inventory.local)};`],
      ["const expectedLibraryCollections = __EXPECTED_LIBRARY_COLLECTIONS__;", `const expectedLibraryCollections = ${JSON.stringify(inventory.libraryCollections)};`],
      ['const selectedScope = "__SELECTED_SCOPE__";', `const selectedScope = ${JSON.stringify(scope)};`],
      ["const startIndex = __START_INDEX__;", `const startIndex = ${startIndex};`],
      ["const batchSize = __BATCH_SIZE__;", `const batchSize = ${batchSize};`],
      ["const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;", `const maxPayloadBytes = ${maxPayloadBytes};`],
    ]);
  }
  const exportPlan = await runExportPlan(baseFigma);
  const localGroup = exportPlan.groups[0];
  const localPlanIds = exportPlan.variableIds.slice(
    localGroup.startIndex,
    localGroup.startIndex + localGroup.variableCount
  );
  async function runLocalExport(
    figma,
    startIndex = 0,
    batchSize = defaultConfig.extraction.maxBatchSize,
    maxPayloadBytes = defaultConfig.extraction.maxPayloadBytes
  ) {
    return runSnippet("05-export-local.js", figma, [
      ['const sourceFileKey = "__FILE_KEY__";', `const sourceFileKey = ${JSON.stringify(fileKey)};`],
      ["const injectedVariableIds = __VARIABLE_IDS__;", `const injectedVariableIds = ${JSON.stringify(localPlanIds)};`],
      ['const expectedVariableIdsChecksum = "__VARIABLE_IDS_CHECKSUM__";', `const expectedVariableIdsChecksum = ${JSON.stringify(inventory.local.variableIdsChecksum)};`],
      ['const expectedUsageChecksum = "__USAGE_CHECKSUM__";', `const expectedUsageChecksum = ${JSON.stringify(inventory.local.usageChecksum)};`],
      ['const expectedDirectVariableIdsChecksum = "__DIRECT_VARIABLE_IDS_CHECKSUM__";', `const expectedDirectVariableIdsChecksum = ${JSON.stringify(directIdsChecksum)};`],
      ["const startIndex = __START_INDEX__;", `const startIndex = ${startIndex};`],
      ["const batchSize = __BATCH_SIZE__;", `const batchSize = ${batchSize};`],
      ["const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;", `const maxPayloadBytes = ${maxPayloadBytes};`],
    ]);
  }
  const local = await runLocalExport(baseFigma);
  const libraryPlan = inventory.libraryCollections[0];
  const libraryGroup = exportPlan.groups[1];
  const libraryPlanIds = exportPlan.variableIds.slice(
    libraryGroup.startIndex,
    libraryGroup.startIndex + libraryGroup.variableCount
  );
  const library = await runSnippet("06-export-library-collection.js", baseFigma, [
    ['const sourceFileKey = "__FILE_KEY__";', `const sourceFileKey = ${JSON.stringify(fileKey)};`],
    ["const injectedVariableIds = __VARIABLE_IDS__;", `const injectedVariableIds = ${JSON.stringify(libraryPlanIds)};`],
    ['const expectedVariableIdsChecksum = "__VARIABLE_IDS_CHECKSUM__";', `const expectedVariableIdsChecksum = ${JSON.stringify(libraryPlan.variableIdsChecksum)};`],
    ['const expectedUsageChecksum = "__USAGE_CHECKSUM__";', `const expectedUsageChecksum = ${JSON.stringify(libraryPlan.usageChecksum)};`],
    ['const expectedDirectVariableIdsChecksum = "__DIRECT_VARIABLE_IDS_CHECKSUM__";', `const expectedDirectVariableIdsChecksum = ${JSON.stringify(directIdsChecksum)};`],
    ['const collectionKey = "__COLLECTION_KEY__";', `const collectionKey = ${JSON.stringify(remoteCollection.key)};`],
    ["const expectedLibraryName = __LIBRARY_NAME__;", `const expectedLibraryName = ${JSON.stringify(libraryPlan.libraryName)};`],
    ["const startIndex = __START_INDEX__;", "const startIndex = 0;"],
    ["const batchSize = __BATCH_SIZE__;", `const batchSize = ${defaultConfig.extraction.maxBatchSize};`],
    ["const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;", `const maxPayloadBytes = ${defaultConfig.extraction.maxPayloadBytes};`],
  ]);

  if (
    !pageList.integrity?.checksum ||
    pageScans.some((scan) => !scan.integrity?.checksum) ||
    !inventory.integrity?.checksum ||
    !exportPlan.integrity?.checksum ||
    !local.integrity?.checksum ||
    !library.integrity?.checksum
  ) {
    throw new Error("Snippet payload checksum is missing");
  }
  if (
    inventory.usage.pageCount !== 2 ||
    inventory.usage.scannedPageCount !== 2 ||
    inventory.usage.directVariableCount !== 3 ||
    inventory.usage.aliasDependencyCount !== 1 ||
    inventory.usage.referencedStyleCount !== 1 ||
    inventory.usage.referencedStylesWithBindings !== 1 ||
    inventory.local.definedVariableCount !== 3 ||
    inventory.local.variableCount !== 2 ||
    !Array.isArray(inventory.local.variableIds) ||
    inventory.local.variableIds.length !== inventory.local.variableCount ||
    checksumPayload(inventory.local.variableIds) !==
      inventory.local.variableIdsChecksum ||
    inventory.libraryCollections.length !== 1 ||
    inventory.libraryCollections[0].variableCount !== 2 ||
    inventory.enabledLibraryCollections.length !== 2 ||
    !inventory.warnings.some((warning) => warning.code === "ENABLED_LIBRARY_UNUSED")
  ) {
    throw new Error("Fan-out inventory did not preserve the expected usage closure");
  }
  if (
    local.pagination.total !== 2 ||
    local.collections[0].variables.some((variable) => variable.id === "local-unused") ||
    library.pagination.total !== 2 ||
    importCallCount !== 0 ||
    libraryVariableEnumerationCallCount !== 0 ||
    localVariableEnumerationCallCount !== 0 ||
    variableResolveCallCount !== 12 ||
    collectionResolveCallCount !== 6
  ) {
    throw new Error(
      "Usage export included unused Variables, repeated full resolution, or mutated Figma"
    );
  }

  const realisticIds = Array.from({ length: 171 }, (_, index) =>
    `VariableID:${index.toString(16).padStart(40, "0")}/${9000 + index}:${index}`
  );
  const realisticLocalIds = realisticIds.slice(0, 20);
  const realisticRemoteIds = realisticIds.slice(20);
  const realisticDirectIds = [
    ...realisticLocalIds,
    ...realisticRemoteIds.slice(0, 133),
  ].sort();
  const realisticLocalCollection = {
    id: "realistic-local-collection",
    key: "realistic-local-key",
    name: "Local",
    remote: false,
    hiddenFromPublishing: false,
    defaultModeId: "light",
    modes: [{ modeId: "light", name: "Light" }],
    variableIds: realisticLocalIds,
  };
  const realisticRemoteCollections = Array.from({ length: 5 }, (_, index) => ({
    id: `realistic-remote-collection-${index}`,
    key: `realistic-remote-key-${index}`,
    name: `Remote ${index}`,
    remote: true,
    hiddenFromPublishing: false,
    defaultModeId: "light",
    modes: [{ modeId: "light", name: "Light" }],
  }));
  const realisticVariables = new Map();
  for (const [index, id] of realisticIds.entries()) {
    const remoteIndex = index - realisticLocalIds.length;
    const collection = index < realisticLocalIds.length
      ? realisticLocalCollection
      : realisticRemoteCollections[Math.floor(remoteIndex / 31)];
    const aliasTarget = index >= 20 && index < 38
      ? realisticRemoteIds[133 + (index - 20)]
      : null;
    realisticVariables.set(id, {
      id,
      key: `realistic-variable-key-${String(index).padStart(3, "0")}`,
      name: `token/${String(index).padStart(3, "0")}`,
      description: "",
      resolvedType: "COLOR",
      remote: index >= realisticLocalIds.length,
      variableCollectionId: collection.id,
      scopes: ["ALL_SCOPES"],
      codeSyntax: {},
      hiddenFromPublishing: false,
      valuesByMode: {
        light: aliasTarget
          ? { type: "VARIABLE_ALIAS", id: aliasTarget }
          : { r: 0, g: 0, b: 0, a: 1 },
      },
    });
  }
  const realisticCollections = new Map([
    [realisticLocalCollection.id, realisticLocalCollection],
    ...realisticRemoteCollections.map((collection) => [collection.id, collection]),
  ]);
  let realisticVariableResolveCount = 0;
  const realisticFigma = {
    ...baseFigma,
    root: { ...baseFigma.root, name: "Synthetic large file" },
    variables: {
      getLocalVariableCollectionsAsync: async () => [realisticLocalCollection],
      getVariableByIdAsync: async (id) => {
        realisticVariableResolveCount += 1;
        return realisticVariables.get(id) ?? null;
      },
      getVariableCollectionByIdAsync: async (id) =>
        realisticCollections.get(id) ?? null,
      getLocalVariablesAsync: async () => {
        throw new Error("Inventory must not enumerate all local Variables");
      },
    },
    teamLibrary: {
      getAvailableLibraryVariableCollectionsAsync: async () =>
        realisticRemoteCollections.map((collection, index) => ({
          key: collection.key,
          name: collection.name,
          libraryName: `Library ${index}`,
        })),
      getVariablesInLibraryCollectionAsync: async () => {
        throw new Error("Inventory must not enumerate Library Variables");
      },
    },
  };
  const realisticPageManifest = [{
    index: 0,
    id: "realistic-page",
    name: "Page",
    scanChecksum: "realistic-page-checksum",
    counts: {
      nodes: 25000,
      nodesWithBindings: 14000,
      referencedStyles: 100,
      referencedStylesWithBindings: 0,
      directVariables: realisticDirectIds.length,
      explicitVariableModeCollections: 0,
      errors: 0,
    },
  }];
  const realisticInventory = await runSnippet("03-inventory.js", realisticFigma, [
    ['const sourceFileKey = "__FILE_KEY__";', `const sourceFileKey = ${JSON.stringify(fileKey)};`],
    ['const injectedPageListChecksum = "__PAGE_LIST_CHECKSUM__";', 'const injectedPageListChecksum = "realistic-page-list-checksum";'],
    ["const injectedPageManifest = __PAGE_MANIFEST__;", `const injectedPageManifest = ${JSON.stringify(realisticPageManifest)};`],
    ["const injectedDirectVariableIds = __DIRECT_VARIABLE_IDS__;", `const injectedDirectVariableIds = ${JSON.stringify(realisticDirectIds)};`],
    ["  __EXPLICIT_VARIABLE_MODE_COLLECTION_IDS__;", "  [];"],
    ["const injectedNaming = __NAMING_CONFIG__;", `const injectedNaming = ${JSON.stringify(defaultConfig.naming)};`],
    ["const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;", `const maxPayloadBytes = ${defaultConfig.extraction.maxInventoryPayloadBytes};`],
  ]);
  const realisticInventoryBytes = Buffer.byteLength(
    JSON.stringify(realisticInventory),
    "utf8"
  );
  const realisticPlan = await runSnippet("04-export-plan.js", realisticFigma, [
    ['const sourceFileKey = "__FILE_KEY__";', `const sourceFileKey = ${JSON.stringify(fileKey)};`],
    ["const injectedDirectVariableIds = __DIRECT_VARIABLE_IDS__;", `const injectedDirectVariableIds = ${JSON.stringify(realisticDirectIds)};`],
    ["const expectedUsage = __EXPECTED_USAGE__;", `const expectedUsage = ${JSON.stringify({
      checksum: realisticInventory.usage.checksum,
      resolvedVariableCount: realisticInventory.usage.resolvedVariableCount,
      resolvedVariableIdsChecksum: realisticInventory.usage.resolvedVariableIdsChecksum,
      directVariableIdsChecksum: realisticInventory.usage.directVariableIdsChecksum,
      directVariableCount: realisticInventory.usage.directVariableCount,
    })};`],
    ["const expectedLocal = __EXPECTED_LOCAL__;", `const expectedLocal = ${JSON.stringify(realisticInventory.local)};`],
    ["const expectedLibraryCollections = __EXPECTED_LIBRARY_COLLECTIONS__;", `const expectedLibraryCollections = ${JSON.stringify(realisticInventory.libraryCollections)};`],
    ['const selectedScope = "__SELECTED_SCOPE__";', 'const selectedScope = "complete";'],
    ["const startIndex = __START_INDEX__;", "const startIndex = 0;"],
    ["const batchSize = __BATCH_SIZE__;", `const batchSize = ${defaultConfig.extraction.maxBatchSize};`],
    ["const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;", `const maxPayloadBytes = ${defaultConfig.extraction.maxPlanPayloadBytes};`],
  ]);
  const realisticPlanBytes = Buffer.byteLength(JSON.stringify(realisticPlan), "utf8");
  if (
    realisticInventory.usage.directVariableCount !== 153 ||
    realisticInventory.usage.resolvedVariableCount !== 171 ||
    realisticInventoryBytes > defaultConfig.extraction.maxInventoryPayloadBytes ||
    realisticPlan.pagination.total !== 171 ||
    realisticPlan.pagination.hasMore !== false ||
    realisticPlanBytes > defaultConfig.extraction.maxPlanPayloadBytes ||
    realisticVariableResolveCount !== 342
  ) {
    throw new Error(
      `Realistic response-limit regression: inventory=${realisticInventoryBytes}, ` +
      `plan=${realisticPlanBytes}, resolves=${realisticVariableResolveCount}`
    );
  }

  const sameNameRemoteCollection = {
    ...remoteCollection,
    name: localCollection.name,
  };
  const sameNameCollections = new Map([
    [localCollection.id, localCollection],
    [sameNameRemoteCollection.id, sameNameRemoteCollection],
  ]);
  const sameNameFigma = {
    ...baseFigma,
    variables: {
      ...baseFigma.variables,
      getVariableByIdAsync: async (id) => variablesById.get(id) ?? null,
      getVariableCollectionByIdAsync: async (id) =>
        sameNameCollections.get(id) ?? null,
    },
    teamLibrary: {
      getAvailableLibraryVariableCollectionsAsync: async () => [
        { ...enabledUsedCollection, name: sameNameRemoteCollection.name },
        enabledUnusedCollection,
      ],
      getVariablesInLibraryCollectionAsync: async () => {
        throw new Error("Inventory must not enumerate Library Variables");
      },
    },
  };
  const sameNameInventory = await runInventory(sameNameFigma);
  if (sameNameInventory.namingPreflight.complete.collisionCount !== 0) {
    throw new Error("A same-name Collection caused a false CSS collision warning");
  }

  const collidingVariables = new Map(variablesById);
  collidingVariables.set("remote-direct", {
    ...variablesById.get("remote-direct"),
    codeSyntax: { WEB: "var(--color-text)" },
  });
  const collisionFigma = {
    ...baseFigma,
    variables: {
      ...baseFigma.variables,
      getVariableByIdAsync: async (id) => collidingVariables.get(id) ?? null,
      getVariableCollectionByIdAsync: async (id) => collectionsById.get(id) ?? null,
    },
    teamLibrary: {
      getAvailableLibraryVariableCollectionsAsync: async () => [
        enabledUsedCollection,
        enabledUnusedCollection,
      ],
      getVariablesInLibraryCollectionAsync: async () => {
        throw new Error("Inventory must not enumerate Library Variables");
      },
    },
  };
  const collisionInventory = await runInventory(collisionFigma);
  if (
    collisionInventory.namingPreflight.localOnly.collisionCount !== 0 ||
    collisionInventory.namingPreflight.complete.collisionCount !== 1 ||
    !collisionInventory.warnings.some(
      (warning) =>
        warning.code === "CSS_NAME_COLLISION_PREDICTED" &&
        warning.scope === "complete"
    )
  ) {
    throw new Error("Inventory did not predict the exact complete-scope CSS collision");
  }

  const largePayloadVariables = new Map(
    [...variablesById.entries()].map(([id, variable]) => [
      id,
      variable.remote
        ? variable
        : { ...variable, description: "あ".repeat(2000) },
    ])
  );
  let adaptiveVariableResolveCount = 0;
  let adaptiveCollectionResolveCount = 0;
  const largePayloadFigma = {
    ...baseFigma,
    variables: {
      ...baseFigma.variables,
      getVariableByIdAsync: async (id) => {
        adaptiveVariableResolveCount += 1;
        return largePayloadVariables.get(id) ?? null;
      },
      getVariableCollectionByIdAsync: async (id) => {
        adaptiveCollectionResolveCount += 1;
        return collectionsById.get(id) ?? null;
      },
    },
  };
  const singleLargeLocal = await runLocalExport(
    largePayloadFigma,
    0,
    1,
    100000
  );
  const completeLargeLocal = await runLocalExport(
    largePayloadFigma,
    0,
    200,
    100000
  );
  const adaptiveLimit = Math.floor(
    (Buffer.byteLength(JSON.stringify(singleLargeLocal), "utf8") +
      Buffer.byteLength(JSON.stringify(completeLargeLocal), "utf8")) /
      2
  );
  adaptiveVariableResolveCount = 0;
  adaptiveCollectionResolveCount = 0;
  const adaptiveFirst = await runLocalExport(
    largePayloadFigma,
    0,
    200,
    adaptiveLimit
  );
  const adaptiveSecond = await runLocalExport(
    largePayloadFigma,
    adaptiveFirst.pagination.nextStartIndex,
    200,
    adaptiveLimit
  );
  if (
    adaptiveFirst.pagination.returnedDescriptorCount !== 1 ||
    adaptiveFirst.pagination.hasMore !== true ||
    Buffer.byteLength(JSON.stringify(adaptiveFirst), "utf8") > adaptiveLimit ||
    adaptiveSecond.pagination.returnedDescriptorCount !== 1 ||
    adaptiveSecond.pagination.hasMore !== false ||
    Buffer.byteLength(JSON.stringify(adaptiveSecond), "utf8") > adaptiveLimit ||
    adaptiveVariableResolveCount !== 3 ||
    adaptiveCollectionResolveCount !== 2
  ) {
    throw new Error("Serialized payload size did not split the local Export safely");
  }
  let oversizedVariableRejected = false;
  try {
    await runLocalExport(largePayloadFigma, 0, 200, 1000);
  } catch (error) {
    oversizedVariableRejected = String(error).includes(
      "A single local Variable exceeds maxPayloadBytes"
    );
  }
  if (!oversizedVariableRejected) {
    throw new Error("A single oversized Variable was not rejected explicitly");
  }

  const localOnlyExportPlan = await runExportPlan(baseFigma, "local-only");

  const rawDirectory = path.join(temporaryRoot, "src", "design-tokens", "raw");
  const pageListPath = path.join(rawDirectory, "page-list.json");
  const pageScanPaths = pageScans.map((scan) =>
    path.join(rawDirectory, "pages", `page-${String(scan.page.index).padStart(4, "0")}.json`)
  );
  const inventoryPath = path.join(rawDirectory, "inventory.json");
  const planPath = path.join(rawDirectory, "plans", "batch-0000.json");
  const localPath = path.join(rawDirectory, "local", "batch-0000.json");
  const libraryPath = path.join(
    rawDirectory,
    "libraries",
    "collection-0000",
    "batch-0000.json"
  );
  const pageListText = `${JSON.stringify(pageList, null, 2)}\n`;
  const pageScanTexts = pageScans.map((scan) => `${JSON.stringify(scan, null, 2)}\n`);
  const inventoryText = `${JSON.stringify(inventory, null, 2)}\n`;
  const completePlanText = `${JSON.stringify(exportPlan, null, 2)}\n`;
  const localPlanText = `${JSON.stringify(localOnlyExportPlan, null, 2)}\n`;
  const localText = `${JSON.stringify(local, null, 2)}\n`;
  const libraryText = `${JSON.stringify(library, null, 2)}\n`;
  const staleLibrary = JSON.parse(libraryText);
  staleLibrary.collections[0].variables[0].name = "tampered/library";
  const staleLibraryText = `${JSON.stringify(staleLibrary, null, 2)}\n`;

  async function writeRawArtifacts(
    libraryPayload = libraryText,
    planPayload = completePlanText
  ) {
    await mkdir(path.dirname(pageScanPaths[0]), { recursive: true });
    await mkdir(path.dirname(localPath), { recursive: true });
    await mkdir(path.dirname(planPath), { recursive: true });
    await mkdir(path.dirname(libraryPath), { recursive: true });
    await writeFile(pageListPath, pageListText);
    for (const [index, pagePath] of pageScanPaths.entries()) {
      await writeFile(pagePath, pageScanTexts[index]);
    }
    await writeFile(inventoryPath, inventoryText);
    await writeFile(planPath, planPayload);
    await writeFile(localPath, localText);
    await writeFile(libraryPath, libraryPayload);
  }
  await writeRawArtifacts(staleLibraryText, localPlanText);

  const preparedPageListPath = path.join(preparedCodeRoot, "page-list.js");
  const pageListPreparation = runPreparer(
    temporaryRoot,
    [
      "--phase", "page-list",
      "--file-key", fileKey,
      "--output", preparedPageListPath,
    ],
    [fileKey]
  );
  const preparedPageList = await new AsyncFunction(
    "figma",
    await readFile(preparedPageListPath, "utf8")
  )(baseFigma);
  if (
    pageListPreparation.phase !== "page-list" ||
    preparedPageList.fileKey !== pageList.fileKey ||
    JSON.stringify(preparedPageList.pages) !== JSON.stringify(pageList.pages)
  ) {
    throw new Error("Prepared page-list code did not reproduce the canonical snippet");
  }
  requireArtifactPath(
    pageListPreparation.artifactPath,
    pageListPath,
    "Page-list preparation"
  );

  const pageWaveDirectory = path.join(preparedCodeRoot, "page-wave");
  const pageWavePreparation = runPreparer(
    temporaryRoot,
    [
      "--phase", "page-wave",
      "--raw-dir", rawDirectory,
      "--start-index", "0",
      "--count", "2",
      "--output-dir", pageWaveDirectory,
    ],
    [fileKey, "VariableID:"]
  );
  if (
    pageWavePreparation.outputs.length !== 2 ||
    pageWavePreparation.callCount !== 2 ||
    pageWavePreparation.execution !== "parallel-tool-calls-required" ||
    pageWavePreparation.outputs.some((entry, index) =>
      entry.pageIndex !== index || entry.artifactPath !== pageScanPaths[index]
    ) ||
    pageWavePreparation.outputs.some((entry) => !path.isAbsolute(entry.artifactPath))
  ) {
    throw new Error("Prepared page wave did not preserve page indices");
  }

  const preparedInventoryPath = path.join(preparedCodeRoot, "inventory.js");
  const inventoryPreparation = runPreparer(
    temporaryRoot,
    [
      "--phase", "inventory",
      "--raw-dir", rawDirectory,
      "--output", preparedInventoryPath,
    ],
    [fileKey, "VariableID:"]
  );
  requireArtifactPath(
    inventoryPreparation.artifactPath,
    inventoryPath,
    "Inventory preparation"
  );
  const preparedInventory = await new AsyncFunction(
    "figma",
    await readFile(preparedInventoryPath, "utf8")
  )(baseFigma);
  if (
    preparedInventory.usage.checksum !== inventory.usage.checksum ||
    preparedInventory.local.usageChecksum !== inventory.local.usageChecksum
  ) {
    throw new Error("Prepared Inventory code changed the usage closure");
  }

  const preparedPlanPath = path.join(preparedCodeRoot, "plan.js");
  const planPreparation = runPreparer(
    temporaryRoot,
    [
      "--phase", "plan",
      "--raw-dir", rawDirectory,
      "--scope", "local-only",
      "--start-index", "0",
      "--output", preparedPlanPath,
    ],
    [fileKey, "VariableID:"]
  );
  requireArtifactPath(planPreparation.artifactPath, planPath, "Export-plan preparation");
  const preparedPlan = await new AsyncFunction(
    "figma",
    await readFile(preparedPlanPath, "utf8")
  )(baseFigma);
  if (
    preparedPlan.source.scope !== "local-only" ||
    preparedPlan.groups[0].usageChecksum !== inventory.local.usageChecksum
  ) {
    throw new Error("Prepared Export-plan code changed the selected scope");
  }
  await rm(planPath);

  const preparedLocalPath = path.join(preparedCodeRoot, "local.js");
  const localPreparation = runPreparer(
    temporaryRoot,
    [
      "--phase", "local",
      "--raw-dir", rawDirectory,
      "--start-index", "0",
      "--output", preparedLocalPath,
    ],
    [fileKey, "VariableID:"]
  );
  const preparedLocal = await new AsyncFunction(
    "figma",
    await readFile(preparedLocalPath, "utf8")
  )(baseFigma);
  if (
    localPreparation.planSource !== "inventory" ||
    preparedLocal.source.usageChecksum !== inventory.local.usageChecksum ||
    preparedLocal.source.usageChecksum === inventory.usage.checksum ||
    preparedLocal.pagination.total !== inventory.local.variableCount
  ) {
    throw new Error("Prepared local code selected the wrong usage checksum");
  }
  requireArtifactPath(localPreparation.artifactPath, localPath, "Local preparation");

  const confidentialOutputValues = [
    fileKey,
    pageList.fileName,
    ...pageList.pages.flatMap((page) => [page.id, page.name]),
    ...[localCollection, remoteCollection].flatMap((collection) => [
      collection.id,
      collection.key,
      collection.name,
    ]),
    enabledUsedCollection.libraryName,
    enabledUnusedCollection.libraryName,
    enabledUnusedCollection.key,
    ...[...localVariables, ...remoteVariables].flatMap((variable) => [
      variable.id,
      variable.key,
      variable.name,
    ]),
    "Enabled Library Collection is not used by this file",
  ];
  const assertSanitizedStdout = (stdout, label) => {
    for (const value of confidentialOutputValues) {
      if (stdout.includes(value)) {
        throw new Error(`${label} exposed confidential provenance: ${value}`);
      }
    }
  };
  const localValidation = runGenerator(
    temporaryRoot,
    ["--input", rawDirectory, "--validate-only", "--local-only"]
  );
  assertSanitizedStdout(localValidation.stdout, "Local validation stdout");
  if (!localValidation.stdout.includes("for the supplied Figma file")) {
    throw new Error("Validation stdout did not use the confidential target placeholder");
  }
  const localDryRun = runGenerator(temporaryRoot, ["--dry-run", "--local-only"]);
  if (
    localDryRun.stdout.includes("--color-library") ||
    localDryRun.stdout.includes("--color-unused-local")
  ) {
    throw new Error("Excluded or unused Variable leaked into local-only dry-run CSS");
  }

  await rm(pageScanPaths[1]);
  const missingPage = runGenerator(temporaryRoot, ["--local-only"], 1);
  if (!missingPage.stderr.includes("Page scan coverage is incomplete")) {
    throw new Error("Missing page-scan evidence was not rejected");
  }
  await writeFile(pageScanPaths[1], pageScanTexts[1]);

  const tamperedPageScan = JSON.parse(pageScanTexts[0]);
  tamperedPageScan.directVariableIds.push("tampered-variable-id");
  await writeFile(pageScanPaths[0], `${JSON.stringify(tamperedPageScan, null, 2)}\n`);
  const pageChecksumRejected = runGenerator(temporaryRoot, ["--local-only"], 1);
  if (!pageChecksumRejected.stderr.includes("payload checksum mismatch")) {
    throw new Error("Tampered page scan was not rejected by checksum validation");
  }
  await writeFile(pageScanPaths[0], pageScanTexts[0]);

  const substitutedPageScan = JSON.parse(pageScanTexts[0]);
  substitutedPageScan.directVariableIds[0] = "different-direct-variable-id";
  substitutedPageScan.directVariableIds.sort();
  await writeFile(
    pageScanPaths[0],
    `${JSON.stringify(resignPayload(substitutedPageScan), null, 2)}\n`
  );
  const pageManifestRejected = runGenerator(temporaryRoot, ["--local-only"], 1);
  if (!pageManifestRejected.stderr.includes("Page evidence does not match")) {
    throw new Error("A re-signed page-scan substitution was not rejected");
  }
  await writeFile(pageScanPaths[0], pageScanTexts[0]);

  const unexpectedPath = path.join(rawDirectory, "unexpected.json");
  await writeFile(unexpectedPath, "{}\n");
  const unexpected = runGenerator(temporaryRoot, ["--local-only"], 1);
  if (!unexpected.stderr.includes("Unexpected JSON file(s)")) {
    throw new Error("Unrecognized temporary JSON was not rejected");
  }
  await rm(unexpectedPath);

  const staleNamingInventory = JSON.parse(inventoryText);
  staleNamingInventory.namingPreflight.config.prefix = "changed";
  await writeFile(
    inventoryPath,
    `${JSON.stringify(resignPayload(staleNamingInventory), null, 2)}\n`
  );
  const staleNamingRejected = runGenerator(temporaryRoot, ["--local-only"], 1);
  if (!staleNamingRejected.stderr.includes("Naming configuration changed")) {
    throw new Error("A naming configuration drift was not rejected");
  }
  await writeFile(inventoryPath, inventoryText);

  const stalePlan = JSON.parse(localPlanText);
  stalePlan.variableIds.reverse();
  stalePlan.pagination.batchIdentityChecksum = checksumPayload(stalePlan.variableIds);
  stalePlan.source.planChecksum = checksumPayload(stalePlan.variableIds);
  await writeFile(
    planPath,
    `${JSON.stringify(resignPayload(stalePlan), null, 2)}\n`
  );
  const stalePlanRejected = runGenerator(temporaryRoot, ["--local-only"], 1);
  if (!stalePlanRejected.stderr.includes("ID checksum mismatch")) {
    throw new Error("A re-signed Export-plan substitution was not rejected");
  }
  await rm(planPath);

  const tamperedEmbeddedPlan = JSON.parse(inventoryText);
  tamperedEmbeddedPlan.local.variableIds.reverse();
  await writeFile(
    inventoryPath,
    `${JSON.stringify(resignPayload(tamperedEmbeddedPlan), null, 2)}\n`
  );
  const embeddedPlanRejected = runGenerator(temporaryRoot, ["--local-only"], 1);
  if (!embeddedPlanRejected.stderr.includes("inventory.local Export plan is inconsistent")) {
    throw new Error("A re-signed embedded local Export plan substitution was not rejected");
  }
  await writeFile(inventoryPath, inventoryText);

  const tampered = JSON.parse(localText);
  tampered.collections[0].variables[0].valuesByMode.light.r = 0.5;
  await writeFile(localPath, `${JSON.stringify(tampered, null, 2)}\n`);
  const rejected = runGenerator(temporaryRoot, ["--local-only"], 1);
  if (!rejected.stderr.includes("payload checksum mismatch")) {
    throw new Error("Tampered payload was not rejected by checksum validation");
  }
  await writeFile(localPath, localText);

  const identityTampered = JSON.parse(localText);
  identityTampered.collections[0].variables[0].key = "different-used-key";
  await writeFile(
    localPath,
    `${JSON.stringify(resignPayload(identityTampered), null, 2)}\n`
  );
  const identityRejected = runGenerator(temporaryRoot, ["--local-only"], 1);
  if (!identityRejected.stderr.includes("Batch identity checksum mismatch")) {
    throw new Error("A same-count usage-set substitution was not rejected");
  }
  await writeFile(localPath, localText);

  const generated = runGenerator(temporaryRoot, ["--local-only"]);
  assertSanitizedStdout(generated.stdout, "Local generation stdout");
  const reportMarker = "Report summary:\n";
  const reportStart = generated.stdout.indexOf(reportMarker);
  if (reportStart < 0) throw new Error("Generator did not print the report summary");
  const report = JSON.parse(generated.stdout.slice(reportStart + reportMarker.length));
  if (
    report.completeness.scope !== "local-usage-only" ||
    report.completeness.pageListPresent !== true ||
    report.completeness.pageCount !== 2 ||
    report.completeness.pageScansVerified !== 2 ||
    report.completeness.payloadChecksumsVerified !== 5 ||
    report.completeness.exportPlanBatches !== 0 ||
    report.completeness.exportPlanSource !== "inventory" ||
    report.completeness.localExpected !== 2 ||
    report.completeness.excludedLibraryVariables !== 2 ||
    report.completeness.enabledLibraryCollections !== 2 ||
    report.completeness.unusedEnabledLibraryCollections !== 1 ||
    report.completeness.excludedLibraryInventoryErrorCount !== 0 ||
    Object.hasOwn(report.completeness, "sourceFileKey") ||
    Object.hasOwn(report.completeness, "excludedLibraryInventoryErrors") ||
    !report.warnings.some((warning) =>
      warning.code === "ENABLED_LIBRARY_UNUSED" && warning.count === 1
    ) ||
    report.warnings.some((warning) => Object.hasOwn(warning, "message"))
  ) {
    throw new Error("Local usage generation report does not contain expected audit data");
  }
  const generatedDirectory = path.join(temporaryRoot, "src", "design-tokens", "generated");
  const localOnlyCss = await readFile(path.join(generatedDirectory, "design-tokens.css"), "utf8");
  if (
    localOnlyCss.includes("--color-library") ||
    localOnlyCss.includes("--color-unused-local")
  ) {
    throw new Error("Local usage CSS contains an excluded or unused Variable");
  }
  if (await exists(rawDirectory)) {
    throw new Error("Empty raw directory remains after successful generation");
  }

  await writeRawArtifacts();
  const fallbackInventory = JSON.parse(inventoryText);
  delete fallbackInventory.local.variableIds;
  await writeFile(
    inventoryPath,
    `${JSON.stringify(resignPayload(fallbackInventory), null, 2)}\n`
  );
  const fallbackLocalPath = path.join(preparedCodeRoot, "local-fallback.js");
  const fallbackPreparation = runPreparer(
    temporaryRoot,
    [
      "--phase", "local",
      "--raw-dir", rawDirectory,
      "--start-index", "0",
      "--output", fallbackLocalPath,
    ],
    [fileKey, "VariableID:"]
  );
  if (fallbackPreparation.planSource !== "export-plan") {
    throw new Error("Local preparation did not fall back to the verified Export plan");
  }
  await writeFile(inventoryPath, inventoryText);
  const preparedLibraryPath = path.join(preparedCodeRoot, "library.js");
  const libraryPreparation = runPreparer(
    temporaryRoot,
    [
      "--phase", "library",
      "--raw-dir", rawDirectory,
      "--collection-index", "0",
      "--start-index", "0",
      "--output", preparedLibraryPath,
    ],
    [fileKey, "VariableID:"]
  );
  requireArtifactPath(
    libraryPreparation.artifactPath,
    libraryPath,
    "Library preparation"
  );
  const preparedLibrary = await new AsyncFunction(
    "figma",
    await readFile(preparedLibraryPath, "utf8")
  )(baseFigma);
  if (
    preparedLibrary.source.usageChecksum !==
      inventory.libraryCollections[0].usageChecksum ||
    preparedLibrary.pagination.total !==
      inventory.libraryCollections[0].variableCount
  ) {
    throw new Error("Prepared Library code changed the Collection usage plan");
  }
  const driftedLibrary = JSON.parse(libraryText);
  const driftedRemoteDirect = driftedLibrary.collections[0].variables.find(
    (variable) => variable.id === "remote-direct"
  );
  driftedRemoteDirect.valuesByMode.light = {
    type: "VARIABLE_ALIAS",
    id: "local-used-1",
  };
  driftedRemoteDirect.valuesByMode.dark = {
    type: "VARIABLE_ALIAS",
    id: "local-used-1",
  };
  await writeFile(
    libraryPath,
    `${JSON.stringify(resignPayload(driftedLibrary), null, 2)}\n`
  );
  const aliasDriftRejected = runGenerator(
    temporaryRoot,
    ["--validate-only"],
    1
  );
  if (
    !aliasDriftRejected.stderr.includes(
      "Exported Alias closure does not match the Inventory Export plan"
    )
  ) {
    throw new Error("A re-signed Alias-closure drift was not rejected");
  }
  await writeFile(libraryPath, libraryText);
  const retainedFile = path.join(rawDirectory, ".keep");
  await writeFile(retainedFile, "retain this non-JSON file\n");
  const completeValidation = runGenerator(temporaryRoot, ["--validate-only"]);
  assertSanitizedStdout(completeValidation.stdout, "Complete validation stdout");
  const completeGenerated = runGenerator(temporaryRoot, []);
  assertSanitizedStdout(completeGenerated.stdout, "Complete generation stdout");
  const completeReportStart = completeGenerated.stdout.indexOf(reportMarker);
  if (completeReportStart < 0) {
    throw new Error("Complete generator did not print the report summary");
  }
  const completeReport = JSON.parse(
    completeGenerated.stdout.slice(completeReportStart + reportMarker.length)
  );
  if (
    completeReport.completeness.scope !== "complete-usage" ||
    completeReport.completeness.payloadChecksumsVerified !== 7 ||
    completeReport.completeness.exportPlanBatches !== 1 ||
    completeReport.completeness.libraryExpected !== 2 ||
    completeReport.completeness.libraryExported !== 2 ||
    completeReport.completeness.libraryCollectionsChecked !== 1
  ) {
    throw new Error("Complete usage generation report regressed");
  }
  const completeCss = await readFile(
    path.join(generatedDirectory, "design-tokens.css"),
    "utf8"
  );
  if (
    !completeCss.includes("--color-library") ||
    !completeCss.includes("--color-primitive") ||
    completeCss.includes("--color-unused-local") ||
    completeCss.includes("unused-enterprise-library-variable")
  ) {
    throw new Error("Complete CSS did not preserve the exact usage closure");
  }
  if (
    !(await exists(retainedFile)) ||
    !(await exists(rawDirectory)) ||
    (await exists(path.dirname(localPath))) ||
    (await exists(path.dirname(planPath))) ||
    (await exists(path.join(rawDirectory, "libraries"))) ||
    (await exists(path.join(rawDirectory, "pages")))
  ) {
    throw new Error("Empty-directory cleanup removed retained data or left empty subdirectories");
  }

  console.log(
    `figma-variable-extract tests passed ` +
    `(171-ID inventory=${realisticInventoryBytes}B, plan=${realisticPlanBytes}B).`
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
  await rm(preparedCodeRoot, { recursive: true, force: true });
}
