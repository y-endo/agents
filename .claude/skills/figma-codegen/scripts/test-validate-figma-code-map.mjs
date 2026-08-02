#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const validator = path.join(scriptDirectory, "validate-figma-code-map.mjs");
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "figma-code-map-test-"));
const assetContent = "fixture-asset\n";
const assetSha256 = createHash("sha256").update(assetContent).digest("hex");
const imageSha256 = "a".repeat(64);
const categories = [
  "identity-hierarchy",
  "component-properties",
  "content",
  "layout",
  "geometry",
  "paint",
  "stroke-radius",
  "effects",
  "typography",
  "variables-styles",
  "assets",
  "responsive",
  "interaction-motion",
  "accessibility",
];

function clone(value) {
  return structuredClone(value);
}

async function digest(paths) {
  const hash = createHash("sha256").update("figma-codegen-files-sha256@1\u0000");
  for (const filePath of [...new Set(paths)].sort()) {
    const bytes = await readFile(path.join(temporaryDirectory, filePath));
    hash.update(filePath).update("\u0000").update(String(bytes.byteLength)).update("\u0000").update(bytes);
  }
  return hash.digest("hex");
}

async function writeFixtureRoot(content) {
  await writeFile(path.join(temporaryDirectory, "src/root.tsx"), content, "utf8");
}

async function makeValidManifest() {
  return {
    schemaVersion: 1,
    source: {
      fileUrl: "https://www.figma.com/design/example-key/example?node-id=1-2",
      revision: { type: "figma-version", value: "1" },
      selectionNodeIds: ["1:2"],
      rootNodeIds: ["1:2"],
    },
    target: {
      stack: "React with TypeScript",
      supportedWidths: { min: 1440, max: 1440, basisRef: "root-placement" },
      breakpoints: [],
      requiredStates: [{ rootNodeId: "1:2", name: "default", basisRef: "root-boundary" }],
      scenarios: [
        {
          name: "desktop-default",
          rootNodeId: "1:2",
          viewport: { width: 1440, height: 900 },
          state: "default",
          evidence: { kind: "figma-node", reference: "1:2" },
        },
      ],
    },
    acquisition: Object.fromEntries(
      [
        "metadata",
        "designContext",
        "screenshot",
        "variables",
        "codeConnect",
        "libraries",
        "assets",
        "motion",
        "shaders",
        "restGapFill",
      ].map((key) => [
        key,
        ["metadata", "designContext", "screenshot", "variables", "codeConnect"].includes(key)
          ? { status: "acquired", via: `mcp:${key}` }
          : { status: "not-applicable", reason: `Fixture: ${key}` },
      ])
    ),
    decisions: {
      "implementation-approval": { kind: "user-decision", summary: "Approved proposal" },
      "root-boundary": { kind: "figma-structure", summary: "Selected frame is a page" },
      "root-placement": { kind: "project-rule", summary: "AppHost mounts routes" },
      "component-reuse": { kind: "project-rule", summary: "Existing component matches" },
      "interaction-source": { kind: "user-decision", summary: "Button behavior is approved" },
    },
    mappings: [
      {
        rootNodeId: "1:2",
        code: [
          { id: "root", path: "src/root.tsx", symbol: "ExamplePage", locator: "export function ExamplePage()" },
          { id: "host", path: "src/host.tsx", symbol: "AppHost", locator: "export function AppHost()" },
          {
            id: "existing-button",
            path: "src/ExistingButton.tsx",
            symbol: "ExistingButton",
            locator: "export function ExistingButton()",
          },
        ],
        implementation: {
          approvalRef: "implementation-approval",
          boundary: { kind: "page", outputCode: "root", basisRef: "root-boundary" },
          placement: { reuseScope: "route", hostCode: "host", basisRef: "root-placement" },
        },
        evidence: {
          identity: {
            category: "identity-hierarchy",
            origin: "figma-property",
            source: { nodeId: "1:2", property: "type", value: "FRAME" },
            target: { code: "root", locator: "export function ExamplePage()", property: "component", value: "ExamplePage" },
            status: "exact",
          },
          geometry: {
            category: "geometry",
            origin: "figma-property",
            source: { nodeId: "1:2", property: "size", value: { width: 1440, height: 900 } },
            target: { code: "root", locator: "export function ExamplePage()", property: "bounds", value: { width: 1440, height: 900 } },
            status: "exact",
          },
          button: {
            category: "component-properties",
            origin: "project-rule",
            source: { nodeId: "1:3", property: "componentKey", value: "button-key" },
            target: { code: "existing-button", locator: "export function ExistingButton()", property: "binding", value: "reuse-existing" },
            status: "transformed",
            basisRef: "component-reuse",
          },
          interaction: {
            category: "interaction-motion",
            origin: "user-decision",
            source: { nodeId: "1:3", property: "activation", value: "button" },
            target: { code: "existing-button", locator: "<button>", property: "behavior", value: "button" },
            status: "transformed",
            basisRef: "interaction-source",
          },
        },
        notApplicable: Object.fromEntries(
          categories
            .filter((category) => ![
              "identity-hierarchy",
              "component-properties",
              "geometry",
              "assets",
              "interaction-motion",
            ].includes(category))
            .map((category) => [category, `Fixture: ${category}`])
        ),
        componentBindings: {
          "button-key": {
            nodeIds: ["1:3"],
            action: "reuse-existing",
            code: "existing-button",
            importFrom: "./ExistingButton",
            consumers: [
              {
                code: "root",
                importLocator: 'import { ExistingButton } from "./ExistingButton";',
                usageLocator: "<ExistingButton />",
              },
            ],
            evidenceRefs: ["button"],
            basisRef: "component-reuse",
          },
        },
      },
    ],
    assets: [
      {
        id: "logo-asset",
        nodeId: "1:4",
        path: "src/logo.bin",
        sha256: assetSha256,
        rootNodeIds: ["1:2"],
      },
    ],
    gaps: [],
    verification: {
      implementation: {
        algorithm: "figma-codegen-files-sha256@1",
        digest: await digest(["src/ExistingButton.tsx", "src/host.tsx", "src/logo.bin", "src/root.tsx"]),
        verifiedAt: "2026-08-02T00:00:00.000Z",
        additionalPaths: [],
      },
      repositoryChecks: [{ command: "fixture-check", result: "pass" }],
      visualComparisons: [
        {
          scenario: "desktop-default",
          source: { width: 1440, height: 900, sha256: imageSha256 },
          implementation: {
            width: 1440,
            height: 900,
            sha256: "b".repeat(64),
            rootBounds: { x: 0, y: 0, width: 1440, height: 900 },
          },
          viewport: { width: 1440, height: 900, devicePixelRatio: 1 },
          metrics: { pixelDiffRatio: 0.01, normalizedRmse: 0.02 },
        },
      ],
      responsiveChecks: [
        {
          scenario: "desktop-default",
          viewport: { width: 1440, height: 900, devicePixelRatio: 1 },
          document: { clientWidth: 1440, scrollWidth: 1440 },
          rootBounds: { x: 0, y: 0, width: 1440, height: 900 },
          assertions: [{ property: "display", expected: "flex", actual: "flex", basisRef: "root-boundary" }],
        },
      ],
    },
  };
}

function addSecondRoot(manifest) {
  manifest.source.rootNodeIds.push("2:2");
  manifest.target.requiredStates.push({ rootNodeId: "2:2", name: "default", basisRef: "root-boundary" });
  manifest.target.scenarios.push({
    name: "secondary-default",
    rootNodeId: "2:2",
    viewport: { width: 1440, height: 900 },
    state: "default",
    evidence: { kind: "figma-node", reference: "2:2" },
  });
  const mapping = clone(manifest.mappings[0]);
  mapping.rootNodeId = "2:2";
  mapping.evidence.identity.source.nodeId = "2:2";
  mapping.evidence.geometry.source.nodeId = "2:2";
  mapping.evidence.button.source.nodeId = "2:3";
  mapping.componentBindings["button-key"].nodeIds = ["2:3"];
  manifest.mappings.push(mapping);
  manifest.assets[0].rootNodeIds.push("2:2");
  manifest.verification.visualComparisons.push({
    ...clone(manifest.verification.visualComparisons[0]),
    scenario: "secondary-default",
  });
  manifest.verification.responsiveChecks.push({
    ...clone(manifest.verification.responsiveChecks[0]),
    scenario: "secondary-default",
  });
  return manifest;
}

async function run(name, manifest) {
  const manifestPath = path.join(temporaryDirectory, `${name}.json`);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return spawnSync(process.execPath, [validator, manifestPath], {
    cwd: temporaryDirectory,
    encoding: "utf8",
  });
}

async function expectValid(name, manifest) {
  const result = await run(name, manifest);
  if (result.status !== 0) throw new Error(`${name} failed\n${result.stdout}${result.stderr}`);
}

async function expectInvalid(name, manifest, expectedMessage) {
  const result = await run(name, manifest);
  if (result.status === 0 || !result.stderr.includes(expectedMessage)) {
    throw new Error(`${name} did not fail with ${JSON.stringify(expectedMessage)}\n${result.stdout}${result.stderr}`);
  }
}

const normalRoot = [
  'import { ExistingButton } from "./ExistingButton";',
  "export function ExamplePage() {",
  "  return <ExistingButton />;",
  "}",
  "",
].join("\n");

try {
  const runtime = spawnSync(process.execPath, [validator, "--check-runtime"], { encoding: "utf8" });
  if (runtime.status !== 0 || !runtime.stdout.includes("required: >=22")) throw new Error("runtime check failed");
  const unsupportedRuntimePreload = path.join(temporaryDirectory, "unsupported-runtime.cjs");
  await writeFile(
    unsupportedRuntimePreload,
    'Object.defineProperty(process.versions, "node", { value: "21.99.0", configurable: true });\n',
    "utf8"
  );
  const unsupportedRuntime = spawnSync(
    process.execPath,
    ["--require", unsupportedRuntimePreload, validator, "--check-runtime"],
    { encoding: "utf8" }
  );
  if (unsupportedRuntime.status === 0 || !unsupportedRuntime.stderr.includes("Unsupported Node.js v21.99.0")) {
    throw new Error("unsupported runtime check failed");
  }

  await mkdir(path.join(temporaryDirectory, "src"));
  await writeFixtureRoot(normalRoot);
  await writeFile(
    path.join(temporaryDirectory, "src/host.tsx"),
    'import { ExamplePage } from "./root";\nexport function AppHost() { return <ExamplePage />; }\n',
    "utf8"
  );
  await writeFile(
    path.join(temporaryDirectory, "src/ExistingButton.tsx"),
    "export function ExistingButton() { return <button>Button</button>; }\n",
    "utf8"
  );
  await writeFile(path.join(temporaryDirectory, "src/logo.bin"), assetContent, "utf8");

  const valid = await makeValidManifest();
  await expectValid("valid", valid);
  const validPath = path.join(temporaryDirectory, "valid-for-digest.json");
  await writeFile(validPath, `${JSON.stringify(valid)}\n`, "utf8");
  const printedDigest = spawnSync(process.execPath, [validator, "--print-digest", validPath], {
    cwd: temporaryDirectory,
    encoding: "utf8",
  });
  if (
    printedDigest.status !== 0 ||
    printedDigest.stdout.trim() !== valid.verification.implementation.digest
  ) {
    throw new Error(`digest output failed\n${printedDigest.stdout}${printedDigest.stderr}`);
  }

  const sourceDigestManifest = clone(valid);
  sourceDigestManifest.source.revision = { type: "evidence-sha256", value: "0".repeat(64) };
  const sourceDigestPath = path.join(temporaryDirectory, "source-digest.json");
  await writeFile(sourceDigestPath, `${JSON.stringify(sourceDigestManifest)}\n`, "utf8");
  const printedSourceDigest = spawnSync(process.execPath, [validator, "--print-source-digest", sourceDigestPath], {
    cwd: temporaryDirectory,
    encoding: "utf8",
  });
  if (printedSourceDigest.status !== 0 || !/^[a-f0-9]{64}$/.test(printedSourceDigest.stdout.trim())) {
    throw new Error(`source digest output failed\n${printedSourceDigest.stdout}${printedSourceDigest.stderr}`);
  }
  sourceDigestManifest.source.revision.value = printedSourceDigest.stdout.trim();
  await expectValid("valid-source-digest", sourceDigestManifest);
  sourceDigestManifest.verification.visualComparisons[0].source.sha256 = "f".repeat(64);
  await expectInvalid("stale-source-digest", sourceDigestManifest, "does not match current Figma evidence");

  await expectInvalid("unreleased-schema", { ...clone(valid), schemaVersion: 2 }, "schemaVersion: must equal 1");

  const missingSelection = clone(valid);
  missingSelection.source.selectionNodeIds = ["9:9"];
  await expectInvalid("missing-url-selection", missingSelection, "must include the URL-selected node 1:2");

  const unknownCapture = clone(valid);
  unknownCapture.verification.visualComparisons[0].capturePath = "capture.png";
  await expectInvalid("unknown-capture", unknownCapture, "capturePath: is not a recognized field");

  const normalizedAlias = clone(valid);
  normalizedAlias.mappings[0].code[1] = {
    id: "host",
    path: "src/./root.tsx",
    symbol: "ExamplePage",
    locator: "function ExamplePage",
  };
  await expectInvalid("normalized-alias-self-host", normalizedAlias, "duplicates a code target identity");

  const symbolAlias = clone(valid);
  symbolAlias.mappings[0].code[1] = {
    id: "host",
    path: "src/root.tsx",
    symbol: "ExamplePage",
    locator: "return <ExistingButton />",
  };
  await expectInvalid("symbol-alias-self-host", symbolAlias, "duplicates a code target identity");

  const requiredHover = clone(valid);
  requiredHover.target.requiredStates.push({ rootNodeId: "1:2", name: "hover", basisRef: "root-boundary" });
  await expectInvalid("missing-required-hover", requiredHover, "missing required state hover");

  const missingRootScenario = clone(valid);
  missingRootScenario.source.rootNodeIds.push("2:2");
  missingRootScenario.target.requiredStates.push({ rootNodeId: "2:2", name: "default", basisRef: "root-boundary" });
  await expectInvalid("missing-root-scenario", missingRootScenario, "missing scenario for selected root 2:2");

  await expectValid("same-component-across-roots", addSecondRoot(clone(valid)));
  const conflictingBinding = addSecondRoot(clone(valid));
  conflictingBinding.mappings[1].componentBindings["button-key"].importFrom = "./OtherButton";
  await expectInvalid("conflicting-component-binding", conflictingBinding, "conflicts with canonical binding");

  const invalidFallback = clone(valid);
  invalidFallback.mappings[0].evidence.button.source.property = "componentKeyFallback";
  await expectInvalid("invalid-component-key-fallback", invalidFallback, "fallback must equal node:<node-id>");

  const wrongAssetRoot = clone(valid);
  wrongAssetRoot.assets[0].rootNodeIds = ["9:999"];
  await expectInvalid("wrong-asset-root", wrongAssetRoot, "must reference a selected root");

  const missingAsset = clone(valid);
  missingAsset.assets = [];
  await expectInvalid("missing-asset", missingAsset, "missing assets evidence or notApplicable reason");

  const staleDigest = clone(valid);
  staleDigest.verification.implementation.digest = "c".repeat(64);
  await expectInvalid("stale-implementation-digest", staleDigest, "does not match current mapped code and assets");

  const commentSymbol = clone(valid);
  commentSymbol.mappings[0].code[0].symbol = "CommentOnly";
  commentSymbol.mappings[0].code[0].locator = "export function ExamplePage()";
  await writeFixtureRoot(`${normalRoot}// export function CommentOnly() {}\n`);
  commentSymbol.verification.implementation.digest = await digest([
    "src/ExistingButton.tsx", "src/host.tsx", "src/logo.bin", "src/root.tsx",
  ]);
  await expectInvalid("comment-only-symbol", commentSymbol, "must be a code declaration");
  await writeFixtureRoot(normalRoot);

  const commentConsumer = clone(valid);
  await writeFixtureRoot([
    '// import { ExistingButton } from "./ExistingButton";',
    "export function ExamplePage() { return null; }",
    "// <ExistingButton />",
    "",
  ].join("\n"));
  commentConsumer.verification.implementation.digest = await digest([
    "src/ExistingButton.tsx", "src/host.tsx", "src/logo.bin", "src/root.tsx",
  ]);
  await expectInvalid("comment-only-import", commentConsumer, "must be an executable import");
  await expectInvalid("comment-only-usage", commentConsumer, "must be an executable JSX usage");
  await writeFixtureRoot(normalRoot);

  const missingInteractionEvidence = clone(valid);
  delete missingInteractionEvidence.mappings[0].evidence.interaction;
  missingInteractionEvidence.mappings[0].notApplicable["interaction-motion"] = "No Figma prototype";
  await expectInvalid(
    "interactive-not-applicable",
    missingInteractionEvidence,
    "interactive code requires mapped interaction-motion evidence"
  );

  const placeholderDestination = await makeValidManifest();
  await writeFixtureRoot([
    'import { ExistingButton } from "./ExistingButton";',
    'export function ExamplePage() { return <><ExistingButton /><a href="#features">Features</a></>; }',
    "",
  ].join("\n"));
  placeholderDestination.mappings[0].code[0].locator = "export function ExamplePage()";
  placeholderDestination.verification.implementation.digest = await digest([
    "src/ExistingButton.tsx", "src/host.tsx", "src/logo.bin", "src/root.tsx",
  ]);
  await expectInvalid("placeholder-destination", placeholderDestination, "do not invent placeholder destinations");
  await writeFixtureRoot(normalRoot);

  const dynamicPlaceholder = await makeValidManifest();
  await writeFixtureRoot([
    'import { ExistingButton } from "./ExistingButton";',
    'const links = [{ label: "Pricing", href: "#" }];',
    'export function ExamplePage() { return <><ExistingButton />{links.map((link) => <a href={link.href}>{link.label}</a>)}</>; }',
    "",
  ].join("\n"));
  dynamicPlaceholder.mappings[0].evidence.interaction.target = {
    code: "root",
    locator: 'href: "#"',
    property: "destination",
    value: "#",
  };
  dynamicPlaceholder.verification.implementation.digest = await digest([
    "src/ExistingButton.tsx", "src/host.tsx", "src/logo.bin", "src/root.tsx",
  ]);
  await expectInvalid("dynamic-placeholder-destination", dynamicPlaceholder, "do not invent placeholder destinations");
  await writeFixtureRoot(normalRoot);

  const unmappedDestination = await makeValidManifest();
  await writeFixtureRoot([
    'import { ExistingButton } from "./ExistingButton";',
    'export function ExamplePage() { return <><ExistingButton /><a href="/pricing">Pricing</a></>; }',
    "",
  ].join("\n"));
  unmappedDestination.verification.implementation.digest = await digest([
    "src/ExistingButton.tsx", "src/host.tsx", "src/logo.bin", "src/root.tsx",
  ]);
  await expectInvalid("unmapped-destination", unmappedDestination, "requires exact evidence");
  const mappedDestination = clone(unmappedDestination);
  mappedDestination.mappings[0].evidence.interaction.target = {
    code: "root",
    locator: 'href="/pricing"',
    property: "destination",
    value: "/pricing",
  };
  await expectValid("mapped-destination", mappedDestination);
  await writeFixtureRoot(normalRoot);

  const conflictWithoutResolution = clone(valid);
  conflictWithoutResolution.mappings[0].evidence.geometry.source.alternatives = [
    { origin: "figma-variable", property: "height", value: "100%" },
  ];
  conflictWithoutResolution.mappings[0].evidence.geometry.status = "transformed";
  conflictWithoutResolution.mappings[0].evidence.geometry.basisRef = "root-boundary";
  await expectInvalid("conflict-without-resolution", conflictWithoutResolution, "conflicting sources require");

  const conflictResolved = clone(conflictWithoutResolution);
  conflictResolved.mappings[0].evidence.geometry.basisRef = "implementation-approval";
  await expectValid("conflict-resolved", conflictResolved);

  const visualMetricFailure = clone(valid);
  visualMetricFailure.verification.visualComparisons[0].metrics.pixelDiffRatio = 0.1;
  await expectInvalid("visual-metric-failure", visualMetricFailure, "must be at most 0.03");

  const horizontalOverflow = clone(valid);
  horizontalOverflow.verification.responsiveChecks[0].document.scrollWidth = 1600;
  await expectInvalid("horizontal-overflow", horizontalOverflow, "must not exceed clientWidth");

  const infrastructureOnly = clone(valid);
  infrastructureOnly.verification.responsiveChecks[0].assertions = [{
    property: "documentScrollWidth",
    expected: 1440,
    actual: 1440,
    basisRef: "root-boundary",
  }];
  await expectInvalid("infrastructure-only-responsive", infrastructureOnly, "rendered layout or content behavior");

  const repeatedWithoutOrder = clone(valid);
  repeatedWithoutOrder.mappings[0].componentBindings["button-key"].nodeIds.push("1:5");
  await expectInvalid("repeated-without-order", repeatedWithoutOrder, "require one exact instanceOrder evidence record");

  const repeatedWithOrder = clone(repeatedWithoutOrder);
  repeatedWithOrder.mappings[0].evidence.buttonOrder = {
    category: "identity-hierarchy",
    origin: "figma-property",
    source: {
      nodeId: "1:2",
      property: "instanceOrder",
      reference: "button-key",
      value: ["Primary", "Secondary"],
    },
    target: {
      code: "root",
      locator: "const buttonLabels",
      property: "literal-order",
      value: ["Primary", "Secondary"],
    },
    status: "exact",
  };
  await writeFixtureRoot([
    'import { ExistingButton } from "./ExistingButton";',
    'const buttonLabels = ["Primary", "Secondary"];',
    "export function ExamplePage() { return <ExistingButton />; }",
    "",
  ].join("\n"));
  repeatedWithOrder.verification.implementation.digest = await digest([
    "src/ExistingButton.tsx", "src/host.tsx", "src/logo.bin", "src/root.tsx",
  ]);
  await expectValid("repeated-with-order", repeatedWithOrder);
  await writeFixtureRoot([
    'import { ExistingButton } from "./ExistingButton";',
    'const buttonLabels = ["Secondary", "Primary"];',
    "export function ExamplePage() { return <ExistingButton />; }",
    "",
  ].join("\n"));
  repeatedWithOrder.verification.implementation.digest = await digest([
    "src/ExistingButton.tsx", "src/host.tsx", "src/logo.bin", "src/root.tsx",
  ]);
  await expectInvalid("repeated-out-of-order", repeatedWithOrder, "is missing or out of order");
  await writeFixtureRoot(normalRoot);

  await writeFile(path.join(temporaryDirectory, "package.json"), '{"dependencies":{"ui":"1"}}\n', "utf8");
  const additionalDigestInput = clone(valid);
  additionalDigestInput.verification.implementation.additionalPaths = ["package.json"];
  additionalDigestInput.verification.implementation.digest = await digest([
    "package.json", "src/ExistingButton.tsx", "src/host.tsx", "src/logo.bin", "src/root.tsx",
  ]);
  await expectValid("additional-digest-input", additionalDigestInput);
  await writeFile(path.join(temporaryDirectory, "package.json"), '{"dependencies":{"ui":"2"}}\n', "utf8");
  await expectInvalid("stale-additional-digest-input", additionalDigestInput, "does not match current mapped code and assets");

  const unresolvedGap = clone(valid);
  unresolvedGap.gaps = [{ reason: "Missing evidence" }];
  await expectInvalid("unresolved-gap", unresolvedGap, "must be empty for completion");

  console.log("Figma-to-code map validator tests passed.");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
