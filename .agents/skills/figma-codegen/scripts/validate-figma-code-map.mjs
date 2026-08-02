#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  findInteractiveJsx,
  findStaticLinkValues,
  hasDeclaration,
  hasImport,
  hasJsxUsage,
  isJsTsPath,
  stripJsTsComments,
  tokenizeJsTs,
} from "./js-ts-source.mjs";

const minimumNodeMajor = 22;

const acquisitionKeys = [
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
];

const requiredAcquisitionKeys = new Set([
  "metadata",
  "designContext",
  "screenshot",
  "variables",
  "codeConnect",
]);

const coverageCategories = [
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

const mandatoryMappedCategories = new Set(["identity-hierarchy", "geometry"]);
const scenarioEvidenceKinds = new Set(["figma-node", "project-rule", "user-decision"]);
const evidenceOrigins = new Set([
  "figma-property",
  "figma-variable",
  "figma-style",
  "figma-code-connect",
  "figma-asset",
  "figma-annotation",
  "project-rule",
  "platform-contract",
  "user-decision",
]);
const maximumPixelDiffRatio = 0.03;
const maximumNormalizedRmse = 0.08;
const timestampFutureToleranceMs = 5 * 60 * 1000;
const infrastructureAssertionProperties = new Set([
  "documentScrollWidth",
  "documentClientWidth",
  "viewportWidth",
  "viewportHeight",
  "rootWidth",
  "rootHeight",
  "rootX",
  "rootY",
]);

function isInfrastructureAssertionProperty(property) {
  return infrastructureAssertionProperties.has(property) || /^(document|viewport|rootBounds)(\.|$)/.test(property);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeRepositoryPath(filePath) {
  if (!isNonEmptyString(filePath)) return false;
  const slashPath = filePath.replaceAll("\\", "/");
  if (path.isAbsolute(filePath) || path.posix.isAbsolute(slashPath) || /^[A-Za-z]:\//.test(slashPath)) {
    return false;
  }
  const normalized = path.posix.normalize(slashPath);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) return false;
  return normalized;
}

function isRepositoryRelative(filePath) {
  return Boolean(normalizeRepositoryPath(filePath));
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function collectScalarValues(value, result = new Set()) {
  if (["string", "number", "boolean"].includes(typeof value)) result.add(String(value));
  else if (Array.isArray(value)) value.forEach((child) => collectScalarValues(child, result));
  else if (isObject(value)) Object.values(value).forEach((child) => collectScalarValues(child, result));
  return result;
}

function findPlaceholders(value, location = "manifest", results = []) {
  if (typeof value === "string" && value.includes("REPLACE_WITH")) {
    results.push(location);
  } else if (Array.isArray(value)) {
    value.forEach((child, index) => findPlaceholders(child, `${location}[${index}]`, results));
  } else if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      findPlaceholders(child, `${location}.${key}`, results);
    }
  }
  return results;
}

function codeTargetIdentity(code) {
  const normalizedPath = normalizeRepositoryPath(code?.path);
  if (!normalizedPath || !isNonEmptyString(code?.locator)) return undefined;
  if (isNonEmptyString(code?.symbol)) return `${normalizedPath}\u0000symbol:${code.symbol}`;
  return `${normalizedPath}\u0000locator:${code.locator}`;
}

function implementationDigest(paths, bytesByPath) {
  const hash = createHash("sha256").update("figma-codegen-files-sha256@1\u0000");
  for (const filePath of [...new Set(paths)].sort()) {
    const bytes = bytesByPath.get(filePath);
    if (!bytes) continue;
    hash.update(filePath).update("\u0000").update(String(bytes.byteLength)).update("\u0000").update(bytes);
  }
  return hash.digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sourceEvidenceDigest(manifest) {
  const scenarios = (Array.isArray(manifest.target?.scenarios) ? manifest.target.scenarios : [])
    .map(({ name, rootNodeId, viewport, state, evidence }) => ({ name, rootNodeId, viewport, state, evidence }))
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
  const evidence = (Array.isArray(manifest.mappings) ? manifest.mappings : [])
    .flatMap((mapping) => Object.entries(isObject(mapping?.evidence) ? mapping.evidence : {}).map(([id, record]) => ({
      rootNodeId: mapping.rootNodeId,
      id,
      category: record?.category,
      origin: record?.origin,
      source: record?.source,
    })))
    .sort((left, right) => `${left.rootNodeId}\u0000${left.id}`.localeCompare(`${right.rootNodeId}\u0000${right.id}`));
  const assets = (Array.isArray(manifest.assets) ? manifest.assets : [])
    .map(({ id, nodeId, reference, sha256, rootNodeIds }) => ({ id, nodeId, reference, sha256, rootNodeIds }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const visualSources = (Array.isArray(manifest.verification?.visualComparisons)
    ? manifest.verification.visualComparisons
    : [])
    .map((comparison) => ({ scenario: comparison?.scenario, source: comparison?.source }))
    .sort((left, right) => String(left.scenario).localeCompare(String(right.scenario)));
  const payload = {
    fileUrl: manifest.source?.fileUrl,
    selectionNodeIds: manifest.source?.selectionNodeIds,
    rootNodeIds: manifest.source?.rootNodeIds,
    scenarios,
    evidence,
    assets,
    visualSources,
  };
  return createHash("sha256")
    .update("figma-codegen-source-evidence-sha256@1\u0000")
    .update(canonicalJson(payload))
    .digest("hex");
}

function countOccurrences(content, needle) {
  if (!isNonEmptyString(needle)) return 0;
  let count = 0;
  let offset = 0;
  while (offset <= content.length - needle.length) {
    const index = content.indexOf(needle, offset);
    if (index === -1) break;
    count += 1;
    offset = index + needle.length;
  }
  return count;
}

function assertSupportedRuntime() {
  const runtimeVersion = process.versions.node;
  const major = Number.parseInt(runtimeVersion.split(".", 1)[0] ?? "", 10);
  if (!Number.isInteger(major) || major < minimumNodeMajor) {
    throw new Error(
      `Unsupported Node.js v${runtimeVersion}. Node.js ${minimumNodeMajor} or later is required. ` +
      "Use a supported Node.js LTS release and retry."
    );
  }
}

function validateManifest(manifest, manifestPath) {
  const errors = [];
  const textChecks = [];
  const semanticChecks = [];
  const interactionChecks = [];
  const assetsToHash = [];
  const implementationPaths = new Set();
  let expectedImplementationDigest;
  const add = (location, message) => errors.push(`${location}: ${message}`);
  const requireObject = (value, location) => {
    if (!isObject(value)) {
      add(location, "must be an object");
      return false;
    }
    return true;
  };
  const requireNonEmpty = (value, location) => {
    if (!isNonEmptyString(value)) add(location, "must be a non-empty string");
  };
  const requirePositiveInteger = (value, location) => {
    if (!Number.isInteger(value) || value <= 0) add(location, "must be a positive integer");
  };
  const allowOnly = (value, fields, location) => {
    if (!isObject(value)) return;
    const allowed = new Set(fields);
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) add(`${location}.${key}`, "is not a recognized field");
    }
  };
  const requireFiniteNumber = (value, location) => {
    if (typeof value !== "number" || !Number.isFinite(value)) add(location, "must be a finite number");
  };
  const requireTimestamp = (value, location) => {
    requireNonEmpty(value, location);
    if (!isNonEmptyString(value)) return;
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      add(location, "must be an ISO-compatible timestamp");
    } else if (timestamp > Date.now() + timestampFutureToleranceMs) {
      add(location, "must not be in the future");
    }
  };
  const requireDecision = (decisionId, location, allowedKinds) => {
    requireNonEmpty(decisionId, location);
    const decision = decisionById.get(decisionId);
    if (!decision) {
      add(location, "must reference a decision");
    } else if (!allowedKinds.has(decision.kind)) {
      add(location, `references a ${decision.kind} decision`);
    }
  };

  if (!requireObject(manifest, manifestPath)) {
    return { errors, textChecks, semanticChecks, interactionChecks, assetsToHash, implementationPaths };
  }
  allowOnly(
    manifest,
    ["schemaVersion", "source", "target", "acquisition", "decisions", "mappings", "assets", "gaps", "verification"],
    "manifest"
  );
  if (manifest.schemaVersion !== 1) add("schemaVersion", "must equal 1");
  for (const location of findPlaceholders(manifest)) {
    add(location, "contains an unresolved REPLACE_WITH placeholder");
  }

  if (requireObject(manifest.source, "source")) {
    allowOnly(manifest.source, ["fileUrl", "revision", "selectionNodeIds", "rootNodeIds"], "source");
    requireNonEmpty(manifest.source.fileUrl, "source.fileUrl");
    if (isNonEmptyString(manifest.source.fileUrl)) {
      let parsed;
      try {
        parsed = new URL(manifest.source.fileUrl);
      } catch {
        add("source.fileUrl", "must be a valid URL");
      }
      if (parsed && !/(^|\.)figma\.com$/i.test(parsed.hostname)) {
        add("source.fileUrl", "must use a figma.com host");
      }
      const urlNodeId = parsed?.searchParams.get("node-id")?.replace("-", ":");
      if (urlNodeId && !manifest.source.selectionNodeIds?.includes(urlNodeId)) {
        add("source.selectionNodeIds", `must include the URL-selected node ${urlNodeId}`);
      }
    }
    if (!Array.isArray(manifest.source.selectionNodeIds) || manifest.source.selectionNodeIds.length === 0) {
      add("source.selectionNodeIds", "must contain the exact node IDs selected by the user");
    }
    if (requireObject(manifest.source.revision, "source.revision")) {
      allowOnly(manifest.source.revision, ["type", "value"], "source.revision");
      if (![
        "figma-version",
        "last-modified",
        "evidence-sha256",
      ].includes(manifest.source.revision.type)) {
        add("source.revision.type", "must be figma-version, last-modified, or evidence-sha256");
      }
      requireNonEmpty(manifest.source.revision.value, "source.revision.value");
      if (
        manifest.source.revision.type === "evidence-sha256" &&
        isNonEmptyString(manifest.source.revision.value) &&
        !/^[a-f0-9]{64}$/i.test(manifest.source.revision.value)
      ) {
        add("source.revision.value", "must be a 64-character SHA-256 digest");
      }
    }
    if (!Array.isArray(manifest.source.rootNodeIds) || manifest.source.rootNodeIds.length === 0) {
      add("source.rootNodeIds", "must contain at least one node ID");
    }
  }

  const rootNodeIds = Array.isArray(manifest.source?.rootNodeIds) ? manifest.source.rootNodeIds : [];
  const selectionNodeIds = Array.isArray(manifest.source?.selectionNodeIds) ? manifest.source.selectionNodeIds : [];
  const selectionSet = new Set();
  for (const [index, nodeId] of selectionNodeIds.entries()) {
    requireNonEmpty(nodeId, `source.selectionNodeIds[${index}]`);
    if (selectionSet.has(nodeId)) add(`source.selectionNodeIds[${index}]`, "must be unique");
    selectionSet.add(nodeId);
  }
  const rootSet = new Set();
  for (const [index, nodeId] of rootNodeIds.entries()) {
    requireNonEmpty(nodeId, `source.rootNodeIds[${index}]`);
    if (rootSet.has(nodeId)) add(`source.rootNodeIds[${index}]`, "must be unique");
    rootSet.add(nodeId);
  }

  const decisionKinds = new Set([
    "figma-structure",
    "figma-code-connect",
    "project-rule",
    "platform-contract",
    "user-decision",
    "approved-deviation",
  ]);
  const decisionById = new Map();
  if (requireObject(manifest.decisions, "decisions")) {
    for (const [decisionId, decision] of Object.entries(manifest.decisions)) {
      const location = `decisions.${decisionId}`;
      requireNonEmpty(decisionId, location);
      if (!requireObject(decision, location)) continue;
      allowOnly(decision, ["kind", "summary", "reference", "value"], location);
      if (!decisionKinds.has(decision.kind)) add(`${location}.kind`, "is not recognized");
      requireNonEmpty(decision.summary, `${location}.summary`);
      decisionById.set(decisionId, decision);
    }
  }

  const scenarioByName = new Map();
  const scenarioCountByRoot = new Map();
  const scenarioWidthsByRoot = new Map();
  const scenarioStatesByRoot = new Map();
  const requiredStatesByRoot = new Map();
  let supportedMinimum;
  let supportedMaximum;
  const breakpointValues = [];
  if (requireObject(manifest.target, "target")) {
    allowOnly(
      manifest.target,
      ["stack", "supportedWidths", "breakpoints", "requiredStates", "scenarios"],
      "target"
    );
    requireNonEmpty(manifest.target.stack, "target.stack");
    if (requireObject(manifest.target.supportedWidths, "target.supportedWidths")) {
      allowOnly(manifest.target.supportedWidths, ["min", "max", "basisRef"], "target.supportedWidths");
      requirePositiveInteger(manifest.target.supportedWidths.min, "target.supportedWidths.min");
      requirePositiveInteger(manifest.target.supportedWidths.max, "target.supportedWidths.max");
      supportedMinimum = manifest.target.supportedWidths.min;
      supportedMaximum = manifest.target.supportedWidths.max;
      if (
        Number.isInteger(supportedMinimum) &&
        Number.isInteger(supportedMaximum) &&
        supportedMinimum > supportedMaximum
      ) {
        add("target.supportedWidths", "min must be less than or equal to max");
      }
      requireDecision(
        manifest.target.supportedWidths.basisRef,
        "target.supportedWidths.basisRef",
        new Set(["project-rule", "platform-contract", "user-decision"])
      );
    }
    if (!Array.isArray(manifest.target.breakpoints)) {
      add("target.breakpoints", "must be an array");
    } else {
      const seenBreakpoints = new Set();
      for (const [index, breakpoint] of manifest.target.breakpoints.entries()) {
        const location = `target.breakpoints[${index}]`;
        if (!requireObject(breakpoint, location)) continue;
        allowOnly(breakpoint, ["value", "basisRef"], location);
        requirePositiveInteger(breakpoint.value, `${location}.value`);
        if (seenBreakpoints.has(breakpoint.value)) add(`${location}.value`, "must be unique");
        seenBreakpoints.add(breakpoint.value);
        if (
          Number.isInteger(supportedMinimum) &&
          Number.isInteger(supportedMaximum) &&
          Number.isInteger(breakpoint.value) &&
          (breakpoint.value <= supportedMinimum || breakpoint.value > supportedMaximum)
        ) {
          add(`${location}.value`, "must be greater than supported min and at most supported max");
        }
        if (Number.isInteger(breakpoint.value)) breakpointValues.push(breakpoint.value);
        requireDecision(
          breakpoint.basisRef,
          `${location}.basisRef`,
          new Set(["project-rule", "platform-contract", "user-decision"])
        );
      }
    }
    if (!Array.isArray(manifest.target.requiredStates) || manifest.target.requiredStates.length === 0) {
      add("target.requiredStates", "must contain at least one required state");
    } else {
      const seenStates = new Set();
      for (const [index, state] of manifest.target.requiredStates.entries()) {
        const location = `target.requiredStates[${index}]`;
        if (!requireObject(state, location)) continue;
        allowOnly(state, ["rootNodeId", "name", "basisRef"], location);
        requireNonEmpty(state.rootNodeId, `${location}.rootNodeId`);
        requireNonEmpty(state.name, `${location}.name`);
        if (!rootSet.has(state.rootNodeId)) {
          add(`${location}.rootNodeId`, "must refer to a selected root node");
        }
        const key = `${state.rootNodeId}\u0000${state.name}`;
        if (seenStates.has(key)) add(location, "must be unique by rootNodeId and name");
        seenStates.add(key);
        if (rootSet.has(state.rootNodeId) && isNonEmptyString(state.name)) {
          if (!requiredStatesByRoot.has(state.rootNodeId)) requiredStatesByRoot.set(state.rootNodeId, new Set());
          requiredStatesByRoot.get(state.rootNodeId).add(state.name);
        }
        requireDecision(
          state.basisRef,
          `${location}.basisRef`,
          new Set(["figma-structure", "project-rule", "platform-contract", "user-decision"])
        );
      }
    }
    if (!Array.isArray(manifest.target.scenarios) || manifest.target.scenarios.length === 0) {
      add("target.scenarios", "must contain at least one scenario");
    } else {
      for (const [index, scenario] of manifest.target.scenarios.entries()) {
        const location = `target.scenarios[${index}]`;
        if (!requireObject(scenario, location)) continue;
        allowOnly(scenario, ["name", "rootNodeId", "viewport", "state", "evidence"], location);
        requireNonEmpty(scenario.name, `${location}.name`);
        if (scenarioByName.has(scenario.name)) add(`${location}.name`, "must be unique");
        else if (isNonEmptyString(scenario.name)) scenarioByName.set(scenario.name, scenario);
        requireNonEmpty(scenario.rootNodeId, `${location}.rootNodeId`);
        if (!rootSet.has(scenario.rootNodeId)) {
          add(`${location}.rootNodeId`, "must refer to a selected root node");
        } else {
          scenarioCountByRoot.set(scenario.rootNodeId, (scenarioCountByRoot.get(scenario.rootNodeId) ?? 0) + 1);
        }
        requireNonEmpty(scenario.state, `${location}.state`);
        if (rootSet.has(scenario.rootNodeId) && isNonEmptyString(scenario.state)) {
          if (!(requiredStatesByRoot.get(scenario.rootNodeId) ?? new Set()).has(scenario.state)) {
            add(`${location}.state`, "must be declared in target.requiredStates for this root");
          }
          if (!scenarioStatesByRoot.has(scenario.rootNodeId)) scenarioStatesByRoot.set(scenario.rootNodeId, new Set());
          scenarioStatesByRoot.get(scenario.rootNodeId).add(scenario.state);
        }
        if (requireObject(scenario.viewport, `${location}.viewport`)) {
          allowOnly(scenario.viewport, ["width", "height"], `${location}.viewport`);
          requirePositiveInteger(scenario.viewport.width, `${location}.viewport.width`);
          requirePositiveInteger(scenario.viewport.height, `${location}.viewport.height`);
          if (
            Number.isInteger(scenario.viewport.width) &&
            Number.isInteger(supportedMinimum) &&
            Number.isInteger(supportedMaximum) &&
            (scenario.viewport.width < supportedMinimum || scenario.viewport.width > supportedMaximum)
          ) {
            add(`${location}.viewport.width`, "must be within target.supportedWidths");
          }
          if (rootSet.has(scenario.rootNodeId) && Number.isInteger(scenario.viewport.width)) {
            if (!scenarioWidthsByRoot.has(scenario.rootNodeId)) scenarioWidthsByRoot.set(scenario.rootNodeId, new Set());
            scenarioWidthsByRoot.get(scenario.rootNodeId).add(scenario.viewport.width);
          }
        }
        if (requireObject(scenario.evidence, `${location}.evidence`)) {
          allowOnly(scenario.evidence, ["kind", "reference"], `${location}.evidence`);
          if (!scenarioEvidenceKinds.has(scenario.evidence.kind)) {
            add(`${location}.evidence.kind`, "must be figma-node, project-rule, or user-decision");
          }
          requireNonEmpty(scenario.evidence.reference, `${location}.evidence.reference`);
          if (["project-rule", "user-decision"].includes(scenario.evidence.kind)) {
            const decision = decisionById.get(scenario.evidence.reference);
            if (!decision) {
              add(`${location}.evidence.reference`, "must reference a decision");
            } else if (decision.kind !== scenario.evidence.kind) {
              add(`${location}.evidence.reference`, `references a ${decision.kind} decision`);
            }
          }
        }
      }
    }
  }
  for (const rootNodeId of rootSet) {
    const requiredStates = requiredStatesByRoot.get(rootNodeId) ?? new Set();
    if (requiredStates.size === 0) add("target.requiredStates", `missing required state inventory for ${rootNodeId}`);
    const scenarioStates = scenarioStatesByRoot.get(rootNodeId) ?? new Set();
    for (const requiredState of requiredStates) {
      if (!scenarioStates.has(requiredState)) {
        add("target.scenarios", `missing required state ${requiredState} for selected root ${rootNodeId}`);
      }
    }
    if (!scenarioCountByRoot.has(rootNodeId)) {
      add("target.scenarios", `missing scenario for selected root ${rootNodeId}`);
    }
    const requiredWidths = new Set([supportedMinimum, supportedMaximum]);
    for (const breakpoint of breakpointValues) {
      if (breakpoint - 1 >= supportedMinimum) requiredWidths.add(breakpoint - 1);
      requiredWidths.add(breakpoint);
    }
    const actualWidths = scenarioWidthsByRoot.get(rootNodeId) ?? new Set();
    for (const requiredWidth of requiredWidths) {
      if (Number.isInteger(requiredWidth) && !actualWidths.has(requiredWidth)) {
        add("target.scenarios", `missing width ${requiredWidth} scenario for selected root ${rootNodeId}`);
      }
    }
  }

  if (requireObject(manifest.acquisition, "acquisition")) {
    allowOnly(manifest.acquisition, acquisitionKeys, "acquisition");
    for (const key of acquisitionKeys) {
      const location = `acquisition.${key}`;
      const record = manifest.acquisition[key];
      if (!requireObject(record, location)) continue;
      allowOnly(record, ["status", "via", "reason"], location);
      if (!["acquired", "not-applicable"].includes(record.status)) {
        add(`${location}.status`, "must be acquired or not-applicable");
      }
      if (requiredAcquisitionKeys.has(key) && record.status !== "acquired") {
        add(`${location}.status`, "is required and must be acquired");
      }
      if (record.status === "acquired") {
        requireNonEmpty(record.via, `${location}.via`);
        if (hasOwn(record, "reason")) add(`${location}.reason`, "must be omitted when acquired");
      }
      if (record.status === "not-applicable") {
        requireNonEmpty(record.reason, `${location}.reason`);
        if (hasOwn(record, "via")) add(`${location}.via`, "must be omitted when not-applicable");
      }
    }
  }

  const mappedRoots = new Set();
  const canonicalComponentBindings = new Map();
  const globalComponentNodeBindings = new Map();
  const assetRoots = new Set(
    (Array.isArray(manifest.assets) ? manifest.assets : []).flatMap((asset) =>
      Array.isArray(asset?.rootNodeIds) ? asset.rootNodeIds : []
    )
  );

  if (!Array.isArray(manifest.mappings) || manifest.mappings.length === 0) {
    add("mappings", "must contain at least one Figma-to-code mapping");
  } else {
    for (const [mappingIndex, mapping] of manifest.mappings.entries()) {
      const location = `mappings[${mappingIndex}]`;
      if (!requireObject(mapping, location)) continue;
      allowOnly(
        mapping,
        ["rootNodeId", "code", "implementation", "evidence", "notApplicable", "componentBindings"],
        location
      );
      requireNonEmpty(mapping.rootNodeId, `${location}.rootNodeId`);
      if (!rootSet.has(mapping.rootNodeId)) {
        add(`${location}.rootNodeId`, "must refer to a selected root node");
      } else if (mappedRoots.has(mapping.rootNodeId)) {
        add(`${location}.rootNodeId`, "must have exactly one mapping per selected root");
      } else {
        mappedRoots.add(mapping.rootNodeId);
      }

      const codeTargetsById = new Map();
      const codeTargetIdentities = new Set();
      if (!Array.isArray(mapping.code) || mapping.code.length === 0) {
        add(`${location}.code`, "must contain at least one code target");
      } else {
        for (const [codeIndex, code] of mapping.code.entries()) {
          const codeLocation = `${location}.code[${codeIndex}]`;
          if (!requireObject(code, codeLocation)) continue;
          allowOnly(code, ["id", "path", "symbol", "locator"], codeLocation);
          requireNonEmpty(code.id, `${codeLocation}.id`);
          if (codeTargetsById.has(code.id)) add(`${codeLocation}.id`, "must be unique within the mapping");
          else if (isNonEmptyString(code.id)) codeTargetsById.set(code.id, code);
          if (!isRepositoryRelative(code.path)) {
            add(`${codeLocation}.path`, "must be a safe repository-relative path");
          }
          const normalizedCodePath = normalizeRepositoryPath(code.path);
          if (normalizedCodePath) implementationPaths.add(normalizedCodePath);
          requireNonEmpty(code.locator, `${codeLocation}.locator`);
          const identity = codeTargetIdentity(code);
          if (identity && codeTargetIdentities.has(identity)) {
            add(codeLocation, "duplicates a code target identity in the same mapping");
          } else if (identity) {
            codeTargetIdentities.add(identity);
          }
          if (normalizedCodePath && isNonEmptyString(code.locator)) {
            textChecks.push({
              path: normalizedCodePath,
              needle: code.locator,
              location: `${codeLocation}.locator`,
              expected: "exactly-one",
            });
          }
          if (normalizedCodePath && isJsTsPath(normalizedCodePath) && !hasOwn(code, "symbol")) {
            add(`${codeLocation}.symbol`, "is required for JS/TS semantic validation");
          }
          if (hasOwn(code, "symbol")) {
            requireNonEmpty(code.symbol, `${codeLocation}.symbol`);
            if (normalizedCodePath && isNonEmptyString(code.symbol)) {
              if (!isJsTsPath(normalizedCodePath)) {
                add(`${codeLocation}.symbol`, "requires a supported JS/TS semantic adapter");
              } else {
                semanticChecks.push({
                  kind: "declaration",
                  path: normalizedCodePath,
                  symbol: code.symbol,
                  location: `${codeLocation}.symbol`,
                });
              }
            }
          }
        }
      }

      const implementation = mapping.implementation;
      let boundary;
      let placement;
      if (requireObject(implementation, `${location}.implementation`)) {
        allowOnly(implementation, ["approvalRef", "boundary", "placement"], `${location}.implementation`);
        requireNonEmpty(implementation.approvalRef, `${location}.implementation.approvalRef`);
        const approvalDecision = decisionById.get(implementation.approvalRef);
        if (!approvalDecision && isNonEmptyString(implementation.approvalRef)) {
          add(`${location}.implementation.approvalRef`, "must reference decisions");
        } else if (approvalDecision && approvalDecision.kind !== "user-decision") {
          add(
            `${location}.implementation.approvalRef`,
            "must reference an explicit user-decision approving the implementation proposal"
          );
        }
        boundary = implementation.boundary;
        if (requireObject(boundary, `${location}.implementation.boundary`)) {
          allowOnly(boundary, ["kind", "outputCode", "basisRef"], `${location}.implementation.boundary`);
          if (!["page", "layout", "component", "section"].includes(boundary.kind)) {
            add(`${location}.implementation.boundary.kind`, "must be page, layout, component, or section");
          }
          requireNonEmpty(boundary.outputCode, `${location}.implementation.boundary.outputCode`);
          if (!codeTargetsById.has(boundary.outputCode)) {
            add(`${location}.implementation.boundary.outputCode`, "must reference mappings[].code[].id");
          }
          requireNonEmpty(boundary.basisRef, `${location}.implementation.boundary.basisRef`);
          const boundaryDecision = decisionById.get(boundary.basisRef);
          if (!boundaryDecision && isNonEmptyString(boundary.basisRef)) {
            add(`${location}.implementation.boundary.basisRef`, "must reference decisions");
          } else if (
            boundaryDecision &&
            ![
              "figma-structure",
              "figma-code-connect",
              "project-rule",
              "platform-contract",
              "user-decision",
            ].includes(boundaryDecision.kind)
          ) {
            add(
              `${location}.implementation.boundary.basisRef`,
              "must reference Figma structure, Code Connect, project, platform, or user evidence"
            );
          }
        }

        placement = implementation.placement;
        if (requireObject(placement, `${location}.implementation.placement`)) {
          allowOnly(placement, ["reuseScope", "hostCode", "basisRef"], `${location}.implementation.placement`);
          const placementScopes = ["route", "page", "feature", "shared", "app-shell", "standalone"];
          if (!placementScopes.includes(placement.reuseScope)) {
            add(
              `${location}.implementation.placement.reuseScope`,
              "must be route, page, feature, shared, app-shell, or standalone"
            );
          }
          requireNonEmpty(placement.basisRef, `${location}.implementation.placement.basisRef`);
          const placementDecision = decisionById.get(placement.basisRef);
          if (!placementDecision && isNonEmptyString(placement.basisRef)) {
            add(`${location}.implementation.placement.basisRef`, "must reference decisions");
          } else if (
            placementDecision &&
            !["project-rule", "platform-contract", "user-decision"].includes(placementDecision.kind)
          ) {
            add(
              `${location}.implementation.placement.basisRef`,
              "must reference a project-rule, platform-contract, or user-decision"
            );
          }
          if (placement.reuseScope === "standalone") {
            if (hasOwn(placement, "hostCode")) {
              add(`${location}.implementation.placement.hostCode`, "must be omitted for standalone output");
            }
            if (placementDecision && placementDecision.kind !== "user-decision") {
              add(
                `${location}.implementation.placement.basisRef`,
                "standalone output requires an explicit user-decision"
              );
            }
          } else {
            requireNonEmpty(placement.hostCode, `${location}.implementation.placement.hostCode`);
            const outputTarget = codeTargetsById.get(boundary?.outputCode);
            const hostTarget = codeTargetsById.get(placement.hostCode);
            if (!hostTarget) {
              add(`${location}.implementation.placement.hostCode`, "must reference mappings[].code[].id");
            } else if (
              outputTarget &&
              codeTargetIdentity(outputTarget) === codeTargetIdentity(hostTarget)
            ) {
              add(
                `${location}.implementation.placement.hostCode`,
                "must identify a code target distinct from outputCode"
              );
            }
          }
        }
      }

      const coveredCategories = new Set();
      if (assetRoots.has(mapping.rootNodeId)) coveredCategories.add("assets");
      const componentEvidenceIds = new Set();
      const instanceOrderEvidence = [];
      const evidence = mapping.evidence;
      if (requireObject(evidence, `${location}.evidence`)) {
        if (Object.keys(evidence).length === 0) add(`${location}.evidence`, "must not be empty");
        for (const [evidenceId, record] of Object.entries(evidence)) {
          const evidenceLocation = `${location}.evidence.${evidenceId}`;
          requireNonEmpty(evidenceId, evidenceLocation);
          if (!requireObject(record, evidenceLocation)) continue;
          allowOnly(
            record,
            ["category", "origin", "source", "target", "status", "basisRef"],
            evidenceLocation
          );
          if (!coverageCategories.includes(record.category)) {
            add(`${evidenceLocation}.category`, "is not recognized");
          } else {
            coveredCategories.add(record.category);
          }
          if (!evidenceOrigins.has(record.origin)) add(`${evidenceLocation}.origin`, "is not recognized");
          if (requireObject(record.source, `${evidenceLocation}.source`)) {
            allowOnly(
              record.source,
              ["nodeId", "property", "value", "reference", "alternatives"],
              `${evidenceLocation}.source`
            );
            requireNonEmpty(record.source.nodeId, `${evidenceLocation}.source.nodeId`);
            requireNonEmpty(record.source.property, `${evidenceLocation}.source.property`);
            if (!hasOwn(record.source, "value") && !isNonEmptyString(record.source.reference)) {
              add(`${evidenceLocation}.source`, "must contain value or reference");
            }
            if (hasOwn(record.source, "alternatives")) {
              if (!Array.isArray(record.source.alternatives) || record.source.alternatives.length === 0) {
                add(`${evidenceLocation}.source.alternatives`, "must contain conflicting source records");
              } else {
                for (const [alternativeIndex, alternative] of record.source.alternatives.entries()) {
                  const alternativeLocation = `${evidenceLocation}.source.alternatives[${alternativeIndex}]`;
                  if (!requireObject(alternative, alternativeLocation)) continue;
                  allowOnly(
                    alternative,
                    ["origin", "nodeId", "property", "value", "reference"],
                    alternativeLocation
                  );
                  if (!evidenceOrigins.has(alternative.origin)) {
                    add(`${alternativeLocation}.origin`, "is not recognized");
                  }
                  requireNonEmpty(alternative.property, `${alternativeLocation}.property`);
                  if (!hasOwn(alternative, "value") && !isNonEmptyString(alternative.reference)) {
                    add(alternativeLocation, "must contain value or reference");
                  }
                }
              }
            }
          }
          if (requireObject(record.target, `${evidenceLocation}.target`)) {
            allowOnly(record.target, ["code", "locator", "property", "value"], `${evidenceLocation}.target`);
            requireNonEmpty(record.target.code, `${evidenceLocation}.target.code`);
            const targetCode = codeTargetsById.get(record.target.code);
            if (!targetCode) {
              add(`${evidenceLocation}.target.code`, "must reference mappings[].code[].id in the same root");
            }
            requireNonEmpty(record.target.locator, `${evidenceLocation}.target.locator`);
            if (
              targetCode &&
              isRepositoryRelative(targetCode.path) &&
              isNonEmptyString(record.target.locator)
            ) {
              textChecks.push({
                path: targetCode.path,
                needle: record.target.locator,
                location: `${evidenceLocation}.target.locator`,
                expected: "at-least-one",
              });
            }
            requireNonEmpty(record.target.property, `${evidenceLocation}.target.property`);
            if (!hasOwn(record.target, "value")) add(`${evidenceLocation}.target.value`, "must be present");
          }
          if (!["exact", "transformed"].includes(record.status)) {
            add(`${evidenceLocation}.status`, "must be exact or transformed");
          } else if (record.status === "transformed") {
            requireNonEmpty(record.basisRef, `${evidenceLocation}.basisRef`);
            if (isNonEmptyString(record.basisRef) && !decisionById.has(record.basisRef)) {
              add(`${evidenceLocation}.basisRef`, "must reference decisions");
            }
          } else if (hasOwn(record, "basisRef")) {
            add(`${evidenceLocation}.basisRef`, "must be omitted for exact evidence");
          }
          if (Array.isArray(record.source?.alternatives) && record.source.alternatives.length > 0) {
            const conflictDecision = decisionById.get(record.basisRef);
            if (record.status !== "transformed") {
              add(`${evidenceLocation}.status`, "must be transformed when source alternatives conflict");
            } else if (
              conflictDecision &&
              !["project-rule", "user-decision", "approved-deviation"].includes(conflictDecision.kind)
            ) {
              add(
                `${evidenceLocation}.basisRef`,
                "conflicting sources require a project-rule, user-decision, or approved-deviation"
              );
            }
          }
          if (record.source?.property === "instanceOrder" || record.target?.property === "literal-order") {
            if (
              record.category !== "identity-hierarchy" ||
              record.source?.property !== "instanceOrder" ||
              record.target?.property !== "literal-order"
            ) {
              add(evidenceLocation, "instance order must use identity-hierarchy instanceOrder to literal-order evidence");
            }
            if (!isNonEmptyString(record.source?.reference)) {
              add(`${evidenceLocation}.source.reference`, "must identify the component key whose instances are ordered");
            }
            if (
              !Array.isArray(record.source?.value) ||
              record.source.value.length === 0 ||
              !Array.isArray(record.target?.value) ||
              !valuesEqual(record.source.value, record.target.value)
            ) {
              add(evidenceLocation, "instanceOrder source and literal-order target must contain the same non-empty array");
            }
            const orderTarget = codeTargetsById.get(record.target?.code);
            const orderPath = normalizeRepositoryPath(orderTarget?.path);
            if (!orderPath || !isJsTsPath(orderPath)) {
              add(`${evidenceLocation}.target.code`, "literal-order requires a JS/TS code target");
            } else if (Array.isArray(record.target?.value) && isNonEmptyString(record.target?.locator)) {
              semanticChecks.push({
                kind: "literal-order",
                path: orderPath,
                locator: record.target.locator,
                expected: record.target.value,
                location: `${evidenceLocation}.target.value`,
              });
            }
            instanceOrderEvidence.push(record);
          }
          if (record.category === "assets") {
            add(`${evidenceLocation}.category`, "must be represented once in the top-level assets array");
          }
          if (record.category === "component-properties") componentEvidenceIds.add(evidenceId);
        }
      }

      const notApplicable = mapping.notApplicable;
      if (requireObject(notApplicable, `${location}.notApplicable`)) {
        for (const [category, reason] of Object.entries(notApplicable)) {
          const categoryLocation = `${location}.notApplicable.${category}`;
          if (!coverageCategories.includes(category)) add(categoryLocation, "is not a recognized category");
          if (coveredCategories.has(category)) add(categoryLocation, "must not duplicate a mapped evidence category");
          requireNonEmpty(reason, categoryLocation);
          coveredCategories.add(category);
        }
        for (const category of coverageCategories) {
          if (!coveredCategories.has(category)) add(location, `missing ${category} evidence or notApplicable reason`);
        }
        for (const category of mandatoryMappedCategories) {
          if (!Object.values(evidence ?? {}).some((record) => record?.category === category)) {
            add(`${location}.evidence`, `${category} is mandatory and cannot be notApplicable`);
          }
        }
      }

      interactionChecks.push({
        paths: [...codeTargetsById.values()]
          .map((code) => normalizeRepositoryPath(code.path))
          .filter((codePath) => codePath && isJsTsPath(codePath)),
        hasEvidence: Object.values(evidence ?? {}).some((record) => record?.category === "interaction-motion"),
        evidenceValues: collectScalarValues(
          Object.values(evidence ?? {}).filter((record) => record?.category === "interaction-motion")
        ),
        location: `${location}.notApplicable.interaction-motion`,
      });

      const componentBindings = mapping.componentBindings;
      if (requireObject(componentBindings, `${location}.componentBindings`)) {
        const bindingEntries = Object.entries(componentBindings);
        const componentPropertiesNotApplicable = hasOwn(notApplicable ?? {}, "component-properties");
        if (componentEvidenceIds.size > 0 && bindingEntries.length === 0) {
          add(
            `${location}.componentBindings`,
            "must inventory every selected or descendant Figma Component, Component Set, and Instance"
          );
        }
        if (componentPropertiesNotApplicable && bindingEntries.length > 0) {
          add(`${location}.componentBindings`, "must be empty when component-properties is notApplicable");
        }
        const boundNodeIds = new Set();
        const boundComponentEvidenceIds = new Set();
        for (const [componentKey, binding] of bindingEntries) {
          const bindingLocation = `${location}.componentBindings.${componentKey}`;
          requireNonEmpty(componentKey, bindingLocation);
          if (!requireObject(binding, bindingLocation)) continue;
          allowOnly(
            binding,
            ["nodeIds", "action", "code", "importFrom", "consumers", "evidenceRefs", "basisRef"],
            bindingLocation
          );
          if (!Array.isArray(binding.nodeIds) || binding.nodeIds.length === 0) {
            add(`${bindingLocation}.nodeIds`, "must contain at least one selected or instance node ID");
          } else {
            const localNodeIds = new Set();
            for (const [nodeIndex, nodeId] of binding.nodeIds.entries()) {
              requireNonEmpty(nodeId, `${bindingLocation}.nodeIds[${nodeIndex}]`);
              if (localNodeIds.has(nodeId)) add(`${bindingLocation}.nodeIds[${nodeIndex}]`, "must be unique");
              if (boundNodeIds.has(nodeId)) {
                add(`${bindingLocation}.nodeIds[${nodeIndex}]`, "must belong to exactly one binding in the root");
              }
              const globalKey = globalComponentNodeBindings.get(nodeId);
              if (globalKey && globalKey !== componentKey) {
                add(`${bindingLocation}.nodeIds[${nodeIndex}]`, "must use one component key across the manifest");
              } else if (isNonEmptyString(nodeId)) {
                globalComponentNodeBindings.set(nodeId, componentKey);
              }
              localNodeIds.add(nodeId);
              boundNodeIds.add(nodeId);
            }
          }
          if (
            Array.isArray(binding.nodeIds) &&
            binding.nodeIds.length > 1 &&
            !instanceOrderEvidence.some((record) =>
              record.source?.reference === componentKey &&
              Array.isArray(record.source?.value) &&
              record.source.value.length === binding.nodeIds.length
            )
          ) {
            add(bindingLocation, "repeated component instances require one exact instanceOrder evidence record");
          }
          if (!["reuse-existing", "create-component"].includes(binding.action)) {
            add(`${bindingLocation}.action`, "must be reuse-existing or create-component");
          }
          requireNonEmpty(binding.code, `${bindingLocation}.code`);
          const bindingCode = codeTargetsById.get(binding.code);
          if (!bindingCode) add(`${bindingLocation}.code`, "must reference mappings[].code[].id");
          requireNonEmpty(binding.importFrom, `${bindingLocation}.importFrom`);

          const bindingIdentity = codeTargetIdentity(bindingCode);
          if (bindingIdentity && ["reuse-existing", "create-component"].includes(binding.action)) {
            const canonical = {
              action: binding.action,
              codeTargetIdentity: bindingIdentity,
              importFrom: binding.importFrom,
            };
            const previous = canonicalComponentBindings.get(componentKey);
            if (previous && JSON.stringify(previous.value) !== JSON.stringify(canonical)) {
              add(bindingLocation, `conflicts with canonical binding at ${previous.location}`);
            } else if (!previous) {
              canonicalComponentBindings.set(componentKey, { value: canonical, location: bindingLocation });
            }
          }

          const standaloneRootBinding =
            placement?.reuseScope === "standalone" && binding.code === boundary?.outputCode;
          if (!Array.isArray(binding.consumers) || binding.consumers.length === 0) {
            if (!standaloneRootBinding) {
              add(`${bindingLocation}.consumers`, "must contain at least one importing consumer");
            }
          } else {
            for (const [consumerIndex, consumer] of binding.consumers.entries()) {
              const consumerLocation = `${bindingLocation}.consumers[${consumerIndex}]`;
              if (!requireObject(consumer, consumerLocation)) continue;
              allowOnly(consumer, ["code", "importLocator", "usageLocator"], consumerLocation);
              requireNonEmpty(consumer.code, `${consumerLocation}.code`);
              const consumerCode = codeTargetsById.get(consumer.code);
              if (!consumerCode) {
                add(`${consumerLocation}.code`, "must reference mappings[].code[].id");
              } else if (bindingIdentity === codeTargetIdentity(consumerCode)) {
                add(`${consumerLocation}.code`, "must identify a consumer distinct from the component target");
              }
              requireNonEmpty(consumer.importLocator, `${consumerLocation}.importLocator`);
              if (
                isNonEmptyString(consumer.importLocator) &&
                isNonEmptyString(binding.importFrom) &&
                !consumer.importLocator.includes(binding.importFrom)
              ) {
                add(`${consumerLocation}.importLocator`, "must contain importFrom");
              }
              requireNonEmpty(consumer.usageLocator, `${consumerLocation}.usageLocator`);
              const consumerPath = normalizeRepositoryPath(consumerCode?.path);
              if (consumerCode && consumerPath) {
                if (isNonEmptyString(consumer.importLocator)) {
                  textChecks.push({
                    path: consumerPath,
                    needle: consumer.importLocator,
                    location: `${consumerLocation}.importLocator`,
                    expected: "exactly-one",
                  });
                }
                if (isNonEmptyString(consumer.usageLocator)) {
                  textChecks.push({
                    path: consumerPath,
                    needle: consumer.usageLocator,
                    location: `${consumerLocation}.usageLocator`,
                    expected: "at-least-one",
                  });
                }
                if (!isJsTsPath(consumerPath) || !isNonEmptyString(bindingCode?.symbol)) {
                  add(consumerLocation, "requires JS/TS code with a declared component symbol");
                } else {
                  semanticChecks.push({
                    kind: "component-consumer",
                    path: consumerPath,
                    symbol: bindingCode.symbol,
                    importFrom: binding.importFrom,
                    importLocation: `${consumerLocation}.importLocator`,
                    usageLocation: `${consumerLocation}.usageLocator`,
                  });
                }
              }
            }
          }

          if (!Array.isArray(binding.evidenceRefs) || binding.evidenceRefs.length === 0) {
            add(`${bindingLocation}.evidenceRefs`, "must reference component-properties evidence");
          } else {
            for (const [evidenceIndex, evidenceRef] of binding.evidenceRefs.entries()) {
              const referenceLocation = `${bindingLocation}.evidenceRefs[${evidenceIndex}]`;
              requireNonEmpty(evidenceRef, referenceLocation);
              const componentEvidence = evidence?.[evidenceRef];
              if (!componentEvidence) {
                add(referenceLocation, "must reference evidence in the same mapping");
              } else if (componentEvidence.category !== "component-properties") {
                add(referenceLocation, "must reference component-properties evidence");
              } else {
                if (boundComponentEvidenceIds.has(evidenceRef)) {
                  add(referenceLocation, "must belong to exactly one component binding");
                }
                boundComponentEvidenceIds.add(evidenceRef);
                if (!binding.nodeIds?.includes(componentEvidence.source?.nodeId)) {
                  add(referenceLocation, "source node must be listed in the binding nodeIds");
                }
                const sourceKey = hasOwn(componentEvidence.source ?? {}, "value")
                  ? componentEvidence.source.value
                  : componentEvidence.source?.reference;
                if (sourceKey !== componentKey) {
                  add(referenceLocation, "source component key must equal the component binding key");
                }
                if (!["componentKey", "componentKeyFallback"].includes(componentEvidence.source?.property)) {
                  add(referenceLocation, "component evidence property must identify componentKey provenance");
                }
                if (
                  componentEvidence.source?.property === "componentKeyFallback" &&
                  componentKey !== `node:${componentEvidence.source?.nodeId}`
                ) {
                  add(referenceLocation, "component key fallback must equal node:<node-id>");
                }
              }
            }
          }
          requireNonEmpty(binding.basisRef, `${bindingLocation}.basisRef`);
          const bindingDecision = decisionById.get(binding.basisRef);
          if (!bindingDecision && isNonEmptyString(binding.basisRef)) {
            add(`${bindingLocation}.basisRef`, "must reference decisions");
          } else if (
            binding.action === "reuse-existing" &&
            bindingDecision &&
            !["figma-code-connect", "project-rule", "user-decision"].includes(bindingDecision.kind)
          ) {
            add(
              `${bindingLocation}.basisRef`,
              "reuse-existing must reference a Code Connect, project-rule, or user-decision"
            );
          } else if (
            binding.action === "create-component" &&
            bindingDecision &&
            !["figma-structure", "project-rule", "user-decision"].includes(bindingDecision.kind)
          ) {
            add(
              `${bindingLocation}.basisRef`,
              "create-component must reference a Figma structure, project-rule, or user-decision"
            );
          }
        }
        for (const evidenceId of componentEvidenceIds) {
          if (!boundComponentEvidenceIds.has(evidenceId)) {
            add(
              `${location}.evidence.${evidenceId}`,
              "component-properties evidence must belong to exactly one component binding"
            );
          }
        }
      }
    }
  }
  for (const rootNodeId of rootSet) {
    if (!mappedRoots.has(rootNodeId)) add("mappings", `missing code mapping for root ${rootNodeId}`);
  }

  const assetById = new Map();
  if (!Array.isArray(manifest.assets)) {
    add("assets", "must be an array");
  } else {
    for (const [index, asset] of manifest.assets.entries()) {
      const location = `assets[${index}]`;
      if (!requireObject(asset, location)) continue;
      allowOnly(asset, ["id", "nodeId", "reference", "path", "sha256", "rootNodeIds"], location);
      requireNonEmpty(asset.id, `${location}.id`);
      if (assetById.has(asset.id)) add(`${location}.id`, "must be unique");
      else if (isNonEmptyString(asset.id)) assetById.set(asset.id, asset);
      if (!isNonEmptyString(asset.nodeId) && !isNonEmptyString(asset.reference)) {
        add(location, "must contain a Figma nodeId or image reference");
      }
      if (!isRepositoryRelative(asset.path)) add(`${location}.path`, "must be a safe repository-relative path");
      const normalizedAssetPath = normalizeRepositoryPath(asset.path);
      if (normalizedAssetPath) implementationPaths.add(normalizedAssetPath);
      if (!isNonEmptyString(asset.sha256) || !/^[a-f0-9]{64}$/i.test(asset.sha256)) {
        add(`${location}.sha256`, "must be a 64-character SHA-256 digest");
      }
      if (normalizedAssetPath && /^[a-f0-9]{64}$/i.test(asset.sha256 ?? "")) {
        assetsToHash.push({ path: normalizedAssetPath, sha256: asset.sha256, location: `${location}.sha256` });
      }
      if (!Array.isArray(asset.rootNodeIds) || asset.rootNodeIds.length === 0) {
        add(`${location}.rootNodeIds`, "must reference at least one selected root");
      } else {
        const localRoots = new Set();
        for (const [rootIndex, rootNodeId] of asset.rootNodeIds.entries()) {
          const rootLocation = `${location}.rootNodeIds[${rootIndex}]`;
          requireNonEmpty(rootNodeId, rootLocation);
          if (!rootSet.has(rootNodeId)) add(rootLocation, "must reference a selected root");
          if (localRoots.has(rootNodeId)) add(rootLocation, "must be unique within the asset");
          localRoots.add(rootNodeId);
        }
      }
    }
  }

  if (!Array.isArray(manifest.gaps)) {
    add("gaps", "must be an array");
  } else if (manifest.gaps.length > 0) {
    add("gaps", `must be empty for completion; found ${manifest.gaps.length}`);
  }

  if (requireObject(manifest.verification, "verification")) {
    allowOnly(
      manifest.verification,
      ["implementation", "repositoryChecks", "visualComparisons", "responsiveChecks"],
      "verification"
    );
    if (requireObject(manifest.verification.implementation, "verification.implementation")) {
      allowOnly(
        manifest.verification.implementation,
        ["algorithm", "digest", "verifiedAt", "additionalPaths"],
        "verification.implementation"
      );
      if (manifest.verification.implementation.algorithm !== "figma-codegen-files-sha256@1") {
        add(
          "verification.implementation.algorithm",
          "must equal figma-codegen-files-sha256@1"
        );
      }
      if (!/^[a-f0-9]{64}$/i.test(manifest.verification.implementation.digest ?? "")) {
        add("verification.implementation.digest", "must be a 64-character SHA-256 digest");
      } else {
        expectedImplementationDigest = manifest.verification.implementation.digest.toLowerCase();
      }
      if (!Array.isArray(manifest.verification.implementation.additionalPaths)) {
        add("verification.implementation.additionalPaths", "must be an array");
      } else {
        const additionalPaths = new Set();
        for (const [index, filePath] of manifest.verification.implementation.additionalPaths.entries()) {
          const location = `verification.implementation.additionalPaths[${index}]`;
          const normalized = normalizeRepositoryPath(filePath);
          if (!normalized) add(location, "must be a safe repository-relative path");
          else if (additionalPaths.has(normalized)) add(location, "must be unique");
          else {
            additionalPaths.add(normalized);
            implementationPaths.add(normalized);
          }
        }
      }
      requireTimestamp(manifest.verification.implementation.verifiedAt, "verification.implementation.verifiedAt");
    }
    const checks = manifest.verification.repositoryChecks;
    if (!Array.isArray(checks) || checks.length === 0) {
      add("verification.repositoryChecks", "must contain at least one check");
    } else {
      for (const [index, check] of checks.entries()) {
        const location = `verification.repositoryChecks[${index}]`;
        if (!requireObject(check, location)) continue;
        allowOnly(check, ["command", "result"], location);
        requireNonEmpty(check.command, `${location}.command`);
        if (check.result !== "pass") add(`${location}.result`, "must equal pass");
      }
    }

    const comparisons = manifest.verification.visualComparisons;
    if (!Array.isArray(comparisons)) {
      add("verification.visualComparisons", "must be an array");
    } else {
      const comparedScenarios = new Set();
      for (const [index, comparison] of comparisons.entries()) {
        const location = `verification.visualComparisons[${index}]`;
        if (!requireObject(comparison, location)) continue;
        allowOnly(
          comparison,
          ["scenario", "source", "implementation", "viewport", "metrics"],
          location
        );
        requireNonEmpty(comparison.scenario, `${location}.scenario`);
        const scenario = scenarioByName.get(comparison.scenario);
        if (!scenario) add(`${location}.scenario`, "must reference a target scenario");
        if (comparedScenarios.has(comparison.scenario)) add(`${location}.scenario`, "must be unique");
        else if (isNonEmptyString(comparison.scenario)) comparedScenarios.add(comparison.scenario);
        if (requireObject(comparison.source, `${location}.source`)) {
          allowOnly(comparison.source, ["width", "height", "sha256"], `${location}.source`);
          requirePositiveInteger(comparison.source.width, `${location}.source.width`);
          requirePositiveInteger(comparison.source.height, `${location}.source.height`);
          if (!/^[a-f0-9]{64}$/i.test(comparison.source.sha256 ?? "")) {
            add(`${location}.source.sha256`, "must be a 64-character SHA-256 digest");
          }
        }

        if (requireObject(comparison.implementation, `${location}.implementation`)) {
          allowOnly(
            comparison.implementation,
            ["width", "height", "sha256", "rootBounds"],
            `${location}.implementation`
          );
          requirePositiveInteger(comparison.implementation.width, `${location}.implementation.width`);
          requirePositiveInteger(comparison.implementation.height, `${location}.implementation.height`);
          if (
            isObject(comparison.source) &&
            (comparison.implementation.width !== comparison.source.width ||
              comparison.implementation.height !== comparison.source.height)
          ) {
            add(`${location}.implementation`, "dimensions must match the source image exactly");
          }
          if (!/^[a-f0-9]{64}$/i.test(comparison.implementation.sha256 ?? "")) {
            add(`${location}.implementation.sha256`, "must be a 64-character SHA-256 digest");
          }
          const rootBounds = comparison.implementation.rootBounds;
          if (requireObject(rootBounds, `${location}.implementation.rootBounds`)) {
            allowOnly(rootBounds, ["x", "y", "width", "height"], `${location}.implementation.rootBounds`);
            requireFiniteNumber(rootBounds.x, `${location}.implementation.rootBounds.x`);
            requireFiniteNumber(rootBounds.y, `${location}.implementation.rootBounds.y`);
            requireFiniteNumber(rootBounds.width, `${location}.implementation.rootBounds.width`);
            requireFiniteNumber(rootBounds.height, `${location}.implementation.rootBounds.height`);
            if (typeof rootBounds.width === "number" && rootBounds.width <= 0) {
              add(`${location}.implementation.rootBounds.width`, "must be positive");
            }
            if (typeof rootBounds.height === "number" && rootBounds.height <= 0) {
              add(`${location}.implementation.rootBounds.height`, "must be positive");
            }
            if (
              isObject(comparison.source) &&
              (Math.abs(rootBounds.width - comparison.source.width) > 0.5 ||
                Math.abs(rootBounds.height - comparison.source.height) > 0.5)
            ) {
              add(`${location}.implementation.rootBounds`, "must match the exact Figma source dimensions");
            }
          }
        }

        if (requireObject(comparison.viewport, `${location}.viewport`)) {
          allowOnly(comparison.viewport, ["width", "height", "devicePixelRatio"], `${location}.viewport`);
          requirePositiveInteger(comparison.viewport.width, `${location}.viewport.width`);
          requirePositiveInteger(comparison.viewport.height, `${location}.viewport.height`);
          if (
            scenario &&
            (comparison.viewport.width !== scenario.viewport?.width ||
              comparison.viewport.height !== scenario.viewport?.height)
          ) {
            add(`${location}.viewport`, "must match the target scenario viewport");
          }
          if (typeof comparison.viewport.devicePixelRatio !== "number" || comparison.viewport.devicePixelRatio <= 0) {
            add(`${location}.viewport.devicePixelRatio`, "must be a positive number");
          }
        }

        if (requireObject(comparison.metrics, `${location}.metrics`)) {
          allowOnly(comparison.metrics, ["pixelDiffRatio", "normalizedRmse"], `${location}.metrics`);
          for (const [metricName, fixedMaximum] of [
            ["pixelDiffRatio", maximumPixelDiffRatio],
            ["normalizedRmse", maximumNormalizedRmse],
          ]) {
            const metric = comparison.metrics[metricName];
            const metricLocation = `${location}.metrics.${metricName}`;
            requireFiniteNumber(metric, metricLocation);
            if (typeof metric === "number" && (metric < 0 || metric > 1)) {
              add(metricLocation, "must be between 0 and 1");
            }
            if (
              typeof metric === "number" &&
              Number.isFinite(metric) &&
              metric > fixedMaximum
            ) {
              add(metricLocation, `must be at most ${fixedMaximum}`);
            }
          }
        }
      }
    }

    const responsiveChecks = manifest.verification.responsiveChecks;
    if (!Array.isArray(responsiveChecks)) {
      add("verification.responsiveChecks", "must be an array");
    } else {
      const checkedScenarios = new Set();
      for (const [index, check] of responsiveChecks.entries()) {
        const location = `verification.responsiveChecks[${index}]`;
        if (!requireObject(check, location)) continue;
        allowOnly(
          check,
          ["scenario", "viewport", "document", "rootBounds", "assertions"],
          location
        );
        requireNonEmpty(check.scenario, `${location}.scenario`);
        const scenario = scenarioByName.get(check.scenario);
        if (!scenario) add(`${location}.scenario`, "must reference a target scenario");
        if (checkedScenarios.has(check.scenario)) add(`${location}.scenario`, "must be unique");
        else if (isNonEmptyString(check.scenario)) checkedScenarios.add(check.scenario);
        if (requireObject(check.viewport, `${location}.viewport`)) {
          allowOnly(check.viewport, ["width", "height", "devicePixelRatio"], `${location}.viewport`);
          requirePositiveInteger(check.viewport.width, `${location}.viewport.width`);
          requirePositiveInteger(check.viewport.height, `${location}.viewport.height`);
          if (
            scenario &&
            (check.viewport.width !== scenario.viewport?.width || check.viewport.height !== scenario.viewport?.height)
          ) {
            add(`${location}.viewport`, "must match the target scenario viewport");
          }
          if (typeof check.viewport.devicePixelRatio !== "number" || check.viewport.devicePixelRatio <= 0) {
            add(`${location}.viewport.devicePixelRatio`, "must be a positive number");
          }
        }
        if (requireObject(check.document, `${location}.document`)) {
          allowOnly(check.document, ["clientWidth", "scrollWidth"], `${location}.document`);
          requireFiniteNumber(check.document.clientWidth, `${location}.document.clientWidth`);
          requireFiniteNumber(check.document.scrollWidth, `${location}.document.scrollWidth`);
          if (typeof check.document.clientWidth === "number" && check.document.clientWidth <= 0) {
            add(`${location}.document.clientWidth`, "must be positive");
          }
          if (typeof check.document.scrollWidth === "number" && check.document.scrollWidth <= 0) {
            add(`${location}.document.scrollWidth`, "must be positive");
          }
          if (
            typeof check.document.clientWidth === "number" &&
            typeof check.document.scrollWidth === "number" &&
            check.document.scrollWidth > check.document.clientWidth + 0.5
          ) {
            add(`${location}.document.scrollWidth`, "must not exceed clientWidth");
          }
        }
        if (requireObject(check.rootBounds, `${location}.rootBounds`)) {
          allowOnly(check.rootBounds, ["x", "y", "width", "height"], `${location}.rootBounds`);
          for (const field of ["x", "y", "width", "height"]) {
            requireFiniteNumber(check.rootBounds[field], `${location}.rootBounds.${field}`);
          }
          if (typeof check.rootBounds.width === "number" && check.rootBounds.width <= 0) {
            add(`${location}.rootBounds.width`, "must be positive");
          }
          if (typeof check.rootBounds.height === "number" && check.rootBounds.height <= 0) {
            add(`${location}.rootBounds.height`, "must be positive");
          }
          if (
            typeof check.rootBounds.x === "number" &&
            typeof check.rootBounds.width === "number" &&
            typeof check.document?.clientWidth === "number" &&
            (check.rootBounds.x < -0.5 ||
              check.rootBounds.x + check.rootBounds.width > check.document.clientWidth + 0.5)
          ) {
            add(`${location}.rootBounds`, "must fit within document.clientWidth");
          }
          if (
            scenario?.evidence?.kind === "figma-node"
          ) {
            const visualComparison = (Array.isArray(comparisons) ? comparisons : []).find(
              (comparison) => comparison?.scenario === scenario.name
            );
            if (
              isObject(visualComparison?.source) &&
              (Math.abs(check.rootBounds.width - visualComparison.source.width) > 0.5 ||
                Math.abs(check.rootBounds.height - visualComparison.source.height) > 0.5)
            ) {
              add(`${location}.rootBounds`, "must match the exact Figma source dimensions");
            }
          }
        }
        if (!Array.isArray(check.assertions) || check.assertions.length === 0) {
          add(`${location}.assertions`, "must contain at least one behavior assertion");
        } else {
          let hasLayoutBehaviorAssertion = false;
          for (const [assertionIndex, assertion] of check.assertions.entries()) {
            const assertionLocation = `${location}.assertions[${assertionIndex}]`;
            if (!requireObject(assertion, assertionLocation)) continue;
            allowOnly(assertion, ["property", "expected", "actual", "basisRef"], assertionLocation);
            requireNonEmpty(assertion.property, `${assertionLocation}.property`);
            if (
              isNonEmptyString(assertion.property) &&
              !isInfrastructureAssertionProperty(assertion.property)
            ) {
              hasLayoutBehaviorAssertion = true;
            }
            if (!hasOwn(assertion, "expected")) add(`${assertionLocation}.expected`, "must be present");
            if (!hasOwn(assertion, "actual")) add(`${assertionLocation}.actual`, "must be present");
            if (hasOwn(assertion, "expected") && hasOwn(assertion, "actual") &&
              !valuesEqual(assertion.expected, assertion.actual)) {
              add(`${assertionLocation}.actual`, "must equal expected");
            }
            requireDecision(assertion.basisRef, `${assertionLocation}.basisRef`, decisionKinds);
          }
          if (!hasLayoutBehaviorAssertion) {
            add(`${location}.assertions`, "must include a rendered layout or content behavior assertion");
          }
        }
      }
    }

    for (const scenario of scenarioByName.values()) {
      if (scenario.evidence?.kind === "figma-node") {
        if (!(Array.isArray(comparisons) ? comparisons : []).some(
          (comparison) => comparison?.scenario === scenario.name
        )) {
          add("verification.visualComparisons", `missing visual comparison for scenario ${scenario.name}`);
        }
      }
      if (!(Array.isArray(responsiveChecks) ? responsiveChecks : []).some(
        (check) => check?.scenario === scenario.name
      )) {
        add("verification.responsiveChecks", `missing responsive check for scenario ${scenario.name}`);
      }
    }
  }

  if (
    manifest.source?.revision?.type === "evidence-sha256" &&
    /^[a-f0-9]{64}$/i.test(manifest.source.revision.value ?? "")
  ) {
    const actualSourceDigest = sourceEvidenceDigest(manifest);
    if (manifest.source.revision.value.toLowerCase() !== actualSourceDigest) {
      add("source.revision.value", `does not match current Figma evidence; expected ${actualSourceDigest}`);
    }
  }

  return {
    errors,
    textChecks,
    semanticChecks,
    interactionChecks,
    assetsToHash,
    implementationPaths,
    expectedImplementationDigest,
  };
}

async function validateReferencedFiles(validation) {
  const errors = [];
  const fileCache = new Map();
  const bytesCache = new Map();
  const tokenCache = new Map();

  const load = async (filePath, location) => {
    if (fileCache.has(filePath)) return fileCache.get(filePath);
    try {
      const content = await readFile(path.resolve(process.cwd(), filePath), "utf8");
      fileCache.set(filePath, content);
      return content;
    } catch (error) {
      errors.push(`${location}: cannot read ${filePath}: ${error.message}`);
      fileCache.set(filePath, undefined);
      return undefined;
    }
  };

  const loadBytes = async (filePath, location) => {
    if (bytesCache.has(filePath)) return bytesCache.get(filePath);
    try {
      const bytes = await readFile(path.resolve(process.cwd(), filePath));
      bytesCache.set(filePath, bytes);
      return bytes;
    } catch (error) {
      errors.push(`${location}: cannot read ${filePath}: ${error.message}`);
      bytesCache.set(filePath, undefined);
      return undefined;
    }
  };

  const tokensFor = async (filePath, location) => {
    if (tokenCache.has(filePath)) return tokenCache.get(filePath);
    const content = await load(filePath, location);
    const tokens = content === undefined ? undefined : tokenizeJsTs(content);
    tokenCache.set(filePath, tokens);
    return tokens;
  };

  for (const check of validation.textChecks) {
    const content = await load(check.path, check.location);
    if (content === undefined) continue;
    const searchable = isJsTsPath(check.path) ? stripJsTsComments(content) : content;
    const occurrences = countOccurrences(searchable, check.needle);
    if (check.expected === "exactly-one" && occurrences !== 1) {
      errors.push(`${check.location}: must occur exactly once in ${check.path}; found ${occurrences}`);
    }
    if (check.expected === "at-least-one" && occurrences < 1) {
      errors.push(`${check.location}: must occur in ${check.path}`);
    }
  }

  for (const check of validation.semanticChecks) {
    const tokens = await tokensFor(check.path, check.location ?? check.importLocation);
    if (!tokens) continue;
    if (check.kind === "declaration" && !hasDeclaration(tokens, check.symbol)) {
      errors.push(`${check.location}: must be a code declaration in ${check.path}`);
    }
    if (check.kind === "component-consumer") {
      if (!hasImport(tokens, check.symbol, check.importFrom)) {
        errors.push(`${check.importLocation}: must be an executable import from ${check.importFrom}`);
      }
      if (!hasJsxUsage(tokens, check.symbol)) {
        errors.push(`${check.usageLocation}: must be an executable JSX usage of ${check.symbol}`);
      }
    }
    if (check.kind === "literal-order") {
      const content = await load(check.path, check.location);
      if (content === undefined) continue;
      const searchable = stripJsTsComments(content);
      const locatorOffset = searchable.indexOf(check.locator);
      const orderedStrings = tokens
        .filter((token) => token.type === "string" && token.start >= locatorOffset)
        .map((token) => token.value);
      let cursor = 0;
      for (const expected of check.expected) {
        while (cursor < orderedStrings.length && orderedStrings[cursor] !== expected) cursor += 1;
        if (cursor >= orderedStrings.length) {
          errors.push(`${check.location}: ${JSON.stringify(expected)} is missing or out of order in ${check.path}`);
          break;
        }
        cursor += 1;
      }
    }
  }

  const allStaticIds = new Set();
  const allFragmentTargets = [];
  const interactiveByPath = new Map();
  for (const filePath of validation.implementationPaths) {
    if (!isJsTsPath(filePath)) continue;
    const tokens = await tokensFor(filePath, "verification.implementation.digest");
    if (!tokens) continue;
    const interactive = findInteractiveJsx(tokens);
    const staticLinks = findStaticLinkValues(tokens);
    interactiveByPath.set(filePath, interactive.elements);
    for (const id of interactive.staticIds) allStaticIds.add(id);
    for (const target of staticLinks.fragmentTargets) allFragmentTargets.push({ path: filePath, target });
  }
  for (const check of validation.interactionChecks) {
    const hasInteractiveCode = check.paths.some((filePath) => (interactiveByPath.get(filePath) ?? []).length > 0);
    if (hasInteractiveCode && !check.hasEvidence) {
      errors.push(`${check.location}: interactive code requires mapped interaction-motion evidence`);
    }
    for (const filePath of check.paths) {
      const tokens = await tokensFor(filePath, check.location);
      if (!tokens) continue;
      for (const destination of findStaticLinkValues(tokens).destinations) {
        if (!check.evidenceValues.has(destination)) {
          errors.push(`${filePath}: interactive destination ${JSON.stringify(destination)} requires exact evidence`);
        }
      }
    }
  }
  for (const fragment of allFragmentTargets) {
    if (!fragment.target || !allStaticIds.has(fragment.target)) {
      errors.push(
        `${fragment.path}: fragment #${fragment.target} has no mapped static target; do not invent placeholder destinations`
      );
    }
  }

  for (const asset of validation.assetsToHash) {
    try {
      const bytes = await loadBytes(asset.path, asset.location);
      if (!bytes) continue;
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (digest.toLowerCase() !== asset.sha256.toLowerCase()) {
        errors.push(`${asset.location}: does not match ${asset.path}`);
      }
    } catch (error) {
      errors.push(`${asset.location}: cannot read ${asset.path}: ${error.message}`);
    }
  }

  for (const filePath of validation.implementationPaths) {
    await loadBytes(filePath, "verification.implementation.digest");
  }
  if (validation.expectedImplementationDigest && [...validation.implementationPaths].every((p) => bytesCache.get(p))) {
    const actual = implementationDigest(validation.implementationPaths, bytesCache);
    if (actual !== validation.expectedImplementationDigest) {
      errors.push(
        `verification.implementation.digest: does not match current mapped code and assets; expected ${actual}`
      );
    }
  }

  return errors;
}

async function printCurrentDigest(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const paths = [
    ...(Array.isArray(manifest.mappings) ? manifest.mappings : []).flatMap((mapping) =>
      (Array.isArray(mapping?.code) ? mapping.code : []).map((code) => code?.path)
    ),
    ...(Array.isArray(manifest.assets) ? manifest.assets : []).map((asset) => asset?.path),
    ...(Array.isArray(manifest.verification?.implementation?.additionalPaths)
      ? manifest.verification.implementation.additionalPaths
      : []),
  ].map(normalizeRepositoryPath);
  if (paths.length === 0 || paths.some((filePath) => !filePath)) {
    throw new Error("map must contain only safe mapped code and asset paths");
  }
  const bytesByPath = new Map();
  for (const filePath of [...new Set(paths)]) {
    bytesByPath.set(filePath, await readFile(path.resolve(process.cwd(), filePath)));
  }
  console.log(implementationDigest(paths, bytesByPath));
}

async function printCurrentSourceDigest(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  console.log(sourceEvidenceDigest(manifest));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log(
      "Usage: node validate-figma-code-map.mjs <manifest.json> [...]\n" +
      "       node validate-figma-code-map.mjs --check-runtime\n" +
      "       node validate-figma-code-map.mjs --print-digest <manifest.json>\n" +
      "       node validate-figma-code-map.mjs --print-source-digest <manifest.json>"
    );
    process.exitCode = args.length === 0 ? 1 : 0;
    return;
  }

  try {
    assertSupportedRuntime();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  if (args.includes("--check-runtime")) {
    if (args.length !== 1) {
      console.error("--check-runtime cannot be combined with manifest paths or other options");
      process.exitCode = 1;
      return;
    }
    console.log(`Node.js runtime is compatible: ${process.version} (required: >=${minimumNodeMajor}).`);
    return;
  }

  if (args.includes("--print-digest")) {
    if (args.length !== 2 || args[0] !== "--print-digest") {
      console.error("--print-digest requires exactly one manifest path");
      process.exitCode = 1;
      return;
    }
    try {
      await printCurrentDigest(args[1]);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  if (args.includes("--print-source-digest")) {
    if (args.length !== 2 || args[0] !== "--print-source-digest") {
      console.error("--print-source-digest requires exactly one manifest path");
      process.exitCode = 1;
      return;
    }
    try {
      await printCurrentSourceDigest(args[1]);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  let failed = false;
  for (const manifestPath of args) {
    let manifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    } catch (error) {
      console.error(`${manifestPath}: ${error.message}`);
      failed = true;
      continue;
    }
    const validation = validateManifest(manifest, manifestPath);
    const errors = [
      ...validation.errors,
      ...(await validateReferencedFiles(validation)),
    ];
    if (errors.length > 0) {
      console.error(`${manifestPath}: validation failed (${errors.length} error(s))`);
      for (const error of errors) console.error(`- ${error}`);
      failed = true;
    } else {
      console.log(`${manifestPath}: valid Figma-to-code map`);
    }
  }

  if (failed) process.exitCode = 1;
}

await main();
