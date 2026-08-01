import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(skillRoot, "../../..");
const generator = path.join(skillRoot, "scripts", "generate-design-tokens.mjs");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const skillInstructions = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
for (const requiredInstruction of [
  "Apply this **hard gate** to every workflow that will validate or generate CSS",
  "There is no default.",
  "Do not run either export script, validate, generate CSS",
  "Even when the initial request appears to name a scope",
]) {
  if (!skillInstructions.includes(requiredInstruction)) {
    throw new Error(`SKILL.md is missing the scope gate: ${requiredInstruction}`);
  }
}

function replaceExactlyOnce(source, expected, replacement) {
  const parts = source.split(expected);
  if (parts.length !== 2) {
    throw new Error(`Expected exactly one placeholder: ${expected}`);
  }
  return `${parts[0]}${replacement}${parts[1]}`;
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

function expectGeneratorFailure(args, expectedMessage) {
  const result = runGenerator(repositoryRoot, args, 1);
  if (!result.stderr.includes(expectedMessage)) {
    throw new Error(
      `Expected generator error containing ${JSON.stringify(expectedMessage)}\n` +
        result.stderr
    );
  }
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

const fileKey = "fixtureFileKey";
const modes = [
  { modeId: "light", name: "Light" },
  { modeId: "dark", name: "Dark" },
];
const collection = {
  id: "collection-id",
  key: "collection-key",
  name: "Semantic",
  remote: false,
  hiddenFromPublishing: false,
  defaultModeId: "light",
  modes,
  variableIds: ["variable-1", "variable-2"],
};
const variables = [
  {
    id: "variable-1",
    key: "variable-key-1",
    name: "color/text",
    description: "",
    resolvedType: "COLOR",
    remote: false,
    variableCollectionId: collection.id,
    scopes: [],
    codeSyntax: { WEB: "var(--color-text)" },
    hiddenFromPublishing: false,
    valuesByMode: {
      light: { r: 0, g: 0, b: 0, a: 1 },
      dark: { r: 1, g: 1, b: 1, a: 1 },
    },
  },
  {
    id: "variable-2",
    key: "variable-key-2",
    name: "color/background",
    description: "",
    resolvedType: "COLOR",
    remote: false,
    variableCollectionId: collection.id,
    scopes: [],
    codeSyntax: { WEB: "Color/Background" },
    hiddenFromPublishing: false,
    valuesByMode: {
      light: { r: 1, g: 1, b: 1, a: 1 },
      dark: { r: 0, g: 0, b: 0, a: 1 },
    },
  },
];
const libraryCollection = {
  key: "library-collection-key",
  name: "Component",
  libraryName: "Fixture Library",
};
const baseFigma = {
  editorType: "figma",
  fileKey,
  root: { name: "Document" },
  variables: {
    getLocalVariableCollectionsAsync: async () => [collection],
    getLocalVariablesAsync: async () => variables,
  },
  teamLibrary: {
    getAvailableLibraryVariableCollectionsAsync: async () => [libraryCollection],
    getVariablesInLibraryCollectionAsync: async () => [
      {
        key: "library-variable-key",
        name: "color/library",
        resolvedType: "COLOR",
      },
    ],
  },
};

const temporaryRoot = await mkdtemp(
  path.join(os.tmpdir(), "figma-variable-extract-test-")
);
try {
  const inventory = await runSnippet("01-inventory.js", baseFigma, [
    ['const sourceFileKey = "__FILE_KEY__";', `const sourceFileKey = ${JSON.stringify(fileKey)};`],
  ]);
  const local = await runSnippet("02-export-local.js", baseFigma, [
    ['const sourceFileKey = "__FILE_KEY__";', `const sourceFileKey = ${JSON.stringify(fileKey)};`],
    ["const startIndex = __START_INDEX__;", "const startIndex = 0;"],
    ["const batchSize = __BATCH_SIZE__;", "const batchSize = 20;"],
  ]);

  if (!inventory.integrity?.checksum || !local.integrity?.checksum) {
    throw new Error("Snippet payload checksum is missing");
  }
  if (inventory.fileKey !== fileKey || local.source.fileKey !== fileKey) {
    throw new Error("Snippet source fileKey is missing");
  }

  const libraryFigma = {
    ...baseFigma,
    variables: {
      ...baseFigma.variables,
      importVariableByKeyAsync: async () => ({
        ...variables[0],
        id: "library-variable-id",
        key: "library-variable-key",
        name: "color/library",
        codeSyntax: { WEB: "var(--color-library)" },
        remote: true,
        variableCollectionId: "library-collection-id",
      }),
      getVariableCollectionByIdAsync: async () => ({
        id: "library-collection-id",
        hiddenFromPublishing: false,
        defaultModeId: "light",
        modes,
      }),
    },
    teamLibrary: {
      getAvailableLibraryVariableCollectionsAsync: async () => [libraryCollection],
      getVariablesInLibraryCollectionAsync: async () => [
        {
          key: "library-variable-key",
          name: "color/library",
          resolvedType: "COLOR",
        },
      ],
    },
  };
  const library = await runSnippet(
    "03-export-library-collection.js",
    libraryFigma,
    [
      ['const sourceFileKey = "__FILE_KEY__";', `const sourceFileKey = ${JSON.stringify(fileKey)};`],
      ['const collectionKey = "__COLLECTION_KEY__";', `const collectionKey = ${JSON.stringify(libraryCollection.key)};`],
      ["const startIndex = __START_INDEX__;", "const startIndex = 0;"],
      ["const batchSize = __BATCH_SIZE__;", "const batchSize = 20;"],
    ]
  );
  if (!library.integrity?.checksum || library.source.fileKey !== fileKey) {
    throw new Error("Library snippet integrity metadata is missing");
  }

  const rawDirectory = path.join(temporaryRoot, "src", "design-tokens", "raw");
  const localPath = path.join(rawDirectory, "local", "batch-0000.json");
  const libraryPath = path.join(
    rawDirectory,
    "libraries",
    "fixture-library",
    "component",
    "batch-0000.json"
  );
  const inventoryText = `${JSON.stringify(inventory, null, 2)}\n`;
  const localText = `${JSON.stringify(local, null, 2)}\n`;
  const libraryText = `${JSON.stringify(library, null, 2)}\n`;
  const staleLibrary = JSON.parse(libraryText);
  staleLibrary.collections[0].variables[0].name = "tampered/library";
  const staleLibraryText = `${JSON.stringify(staleLibrary, null, 2)}\n`;
  async function writeRawArtifacts(libraryPayload = libraryText) {
    await mkdir(path.dirname(localPath), { recursive: true });
    await mkdir(path.dirname(libraryPath), { recursive: true });
    await writeFile(path.join(rawDirectory, "inventory.json"), inventoryText);
    await writeFile(localPath, localText);
    await writeFile(libraryPath, libraryPayload);
  }
  await writeRawArtifacts(staleLibraryText);

  runGenerator(temporaryRoot, [
    "--input",
    rawDirectory,
    "--validate-only",
    "--local-only",
  ]);
  const localDryRun = runGenerator(temporaryRoot, ["--dry-run", "--local-only"]);
  if (localDryRun.stdout.includes("--color-library")) {
    throw new Error("Library Variable leaked into local-only dry-run CSS");
  }
  if (!(await exists(localPath))) {
    throw new Error("Temporary JSON was deleted by dry-run");
  }

  const unexpectedPath = path.join(rawDirectory, "unexpected.json");
  await writeFile(unexpectedPath, "{}\n");
  const unexpected = runGenerator(temporaryRoot, ["--local-only"], 1);
  if (!unexpected.stderr.includes("Unexpected JSON file(s)")) {
    throw new Error("Unrecognized temporary JSON was not rejected");
  }
  if (!(await exists(unexpectedPath)) || !(await exists(localPath))) {
    throw new Error("Temporary JSON was deleted after an input-safety failure");
  }
  await rm(unexpectedPath);

  const tampered = JSON.parse(localText);
  tampered.collections[0].variables[0].valuesByMode.light.r = 0.5;
  await writeFile(localPath, `${JSON.stringify(tampered, null, 2)}\n`);
  const rejected = runGenerator(temporaryRoot, ["--local-only"], 1);
  if (!rejected.stderr.includes("payload checksum mismatch")) {
    throw new Error("Tampered payload was not rejected by checksum validation");
  }
  if (!(await exists(localPath))) {
    throw new Error("Temporary JSON was deleted after failed generation");
  }
  await writeFile(localPath, localText);

  const generated = runGenerator(temporaryRoot, ["--local-only"]);
  const reportMarker = "Report summary:\n";
  const reportStart = generated.stdout.indexOf(reportMarker);
  if (reportStart < 0) {
    throw new Error("Generator did not print the temporary report summary");
  }
  const report = JSON.parse(
    generated.stdout.slice(reportStart + reportMarker.length)
  );
  if (
    report.completeness.sourceFileKey !== fileKey ||
    report.completeness.scope !== "local-only" ||
    report.completeness.payloadChecksumsVerified !== 2 ||
    report.completeness.libraryCollectionsChecked !== 0 ||
    report.completeness.excludedLibraryCollections !== 1 ||
    report.completeness.excludedLibraryVariables !== 1 ||
    report.completeness.excludedLibraryExportFiles !== 1 ||
    report.completeness.excludedLibraryInventoryErrors.length !== 0 ||
    report.counts.cssNameSources.web !== 1 ||
    report.counts.cssNameSources.derived !== 1 ||
    !report.warnings.some(
      (warning) => warning.code === "INVALID_WEB_CODE_SYNTAX"
    )
  ) {
    throw new Error("Generator report does not contain expected audit data");
  }
  const generatedDirectory = path.join(
    temporaryRoot,
    "src",
    "design-tokens",
    "generated"
  );
  if (!(await exists(path.join(generatedDirectory, "design-tokens.css")))) {
    throw new Error("Generated CSS is missing");
  }
  const localOnlyCss = await readFile(
    path.join(generatedDirectory, "design-tokens.css"),
    "utf8"
  );
  if (localOnlyCss.includes("--color-library")) {
    throw new Error("Library Variable leaked into local-only generated CSS");
  }
  if (
    (await exists(path.join(rawDirectory, "inventory.json"))) ||
    (await exists(localPath)) ||
    (await exists(libraryPath)) ||
    (await exists(path.join(generatedDirectory, "design-tokens.report.json")))
  ) {
    throw new Error("Temporary JSON remains after successful generation");
  }
  if (await exists(rawDirectory)) {
    throw new Error("Empty raw directory remains after successful generation");
  }
  if (!generated.stdout.includes("empty temporary directories")) {
    throw new Error("Generator did not report empty-directory cleanup");
  }

  await writeRawArtifacts();
  const retainedFile = path.join(rawDirectory, ".keep");
  await writeFile(retainedFile, "retain this non-JSON file\n");
  runGenerator(temporaryRoot, ["--validate-only"]);
  const completeGenerated = runGenerator(temporaryRoot, []);
  const completeReportStart = completeGenerated.stdout.indexOf(reportMarker);
  if (completeReportStart < 0) {
    throw new Error("Complete generator did not print the report summary");
  }
  const completeReport = JSON.parse(
    completeGenerated.stdout.slice(completeReportStart + reportMarker.length)
  );
  if (
    completeReport.completeness.scope !== "complete" ||
    completeReport.completeness.payloadChecksumsVerified !== 3 ||
    completeReport.completeness.libraryExpected !== 1 ||
    completeReport.completeness.libraryExported !== 1 ||
    completeReport.completeness.libraryCollectionsChecked !== 1 ||
    completeReport.completeness.excludedLibraryExportFiles !== 0
  ) {
    throw new Error("Complete generation report regressed");
  }
  const completeCss = await readFile(
    path.join(generatedDirectory, "design-tokens.css"),
    "utf8"
  );
  if (!completeCss.includes("--color-library")) {
    throw new Error("Complete generated CSS is missing the Library Variable");
  }
  if (
    !(await exists(retainedFile)) ||
    !(await exists(rawDirectory)) ||
    (await exists(path.dirname(localPath))) ||
    (await exists(path.join(rawDirectory, "libraries")))
  ) {
    throw new Error("Empty-directory cleanup removed non-empty input or left empty subdirectories");
  }

  console.log("figma-variable-extract tests passed.");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
