// Figma Remote MCP / use_figma 用
// 実行前にsourceFileKey、ページ証跡、direct ID集合を置換すること。

const sourceFileKey = "__FILE_KEY__";
const injectedPageListChecksum = "__PAGE_LIST_CHECKSUM__";
const injectedPageManifest = __PAGE_MANIFEST__;
const injectedDirectVariableIds = __DIRECT_VARIABLE_IDS__;
const injectedExplicitVariableModeCollectionIds =
  __EXPLICIT_VARIABLE_MODE_COLLECTION_IDS__;
const injectedNaming = __NAMING_CONFIG__;
const maxPayloadBytes = __MAX_PAYLOAD_BYTES__;

if (figma.editorType !== "figma") {
  throw new Error(`Unsupported Figma editor type: ${figma.editorType}`);
}
if (
  typeof sourceFileKey !== "string" ||
  sourceFileKey.length === 0 ||
  sourceFileKey === "__FILE_KEY__"
) {
  throw new Error("sourceFileKey was not configured");
}

const runtimeFileKey =
  typeof figma.fileKey === "string" && figma.fileKey.length > 0
    ? figma.fileKey
    : null;
if (runtimeFileKey && runtimeFileKey !== sourceFileKey) {
  throw new Error(
    `Figma file key mismatch: expected ${sourceFileKey}, got ${runtimeFileKey}`
  );
}

const formatError = (error) => (error instanceof Error ? error.message : String(error));
const assertObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
};
const assertNonNegativeInteger = (value, label) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
};
const checksumPayload = (payload) => {
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
};
const utf8ByteLength = (text) => {
  let bytes = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    bytes +=
      codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
};
const collectVariableAliases = (value, destination) => {
  if (!value || typeof value !== "object") return;
  if (
    value.type === "VARIABLE_ALIAS" &&
    typeof value.id === "string" &&
    value.id.length > 0
  ) {
    destination.add(value.id);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectVariableAliases(entry, destination);
    return;
  }
  for (const entry of Object.values(value)) {
    collectVariableAliases(entry, destination);
  }
};
const variableIdentityChecksum = (records) =>
  checksumPayload(
    records
      .map(({ variable, collection }) => ({
        id: variable.id,
        key: variable.key,
        collectionKey: collection.key,
      }))
      .sort((a, b) => a.key.localeCompare(b.key) || a.id.localeCompare(b.id))
  );
const variableIdChecksum = (records) =>
  checksumPayload(records.map(({ variable }) => variable.id));
const codePointSlug = (value) => {
  const normalized = value.normalize("NFKC");
  const parts = [];
  let pendingSeparator = false;
  for (const character of normalized) {
    if (/^[A-Za-z0-9]$/.test(character)) {
      if (pendingSeparator && parts.length > 0 && parts.at(-1) !== "-") {
        parts.push("-");
      }
      parts.push(character.toLowerCase());
      pendingSeparator = false;
      continue;
    }
    if (/^[\s/_:.]+$/.test(character) || character === "-") {
      pendingSeparator = true;
      continue;
    }
    if (pendingSeparator && parts.length > 0 && parts.at(-1) !== "-") {
      parts.push("-");
    }
    const codePoint = character.codePointAt(0);
    parts.push(codePoint === undefined ? "u0" : `u${codePoint.toString(16)}`);
    pendingSeparator = true;
  }
  return parts.join("").replace(/-+/g, "-").replace(/^-|-$/g, "");
};
const extractCssNameFromWebSyntax = (webSyntax) => {
  if (!webSyntax) return null;
  const trimmed = webSyntax.trim();
  const varMatch = trimmed.match(
    /^var\(\s*(--[A-Za-z0-9_-]+)(?:\s*,[^)]*)?\s*\)$/
  );
  if (varMatch?.[1]) return varMatch[1];
  if (/^--[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
};
const buildCssName = (record, libraryName) => {
  const webSyntax = record.variable.codeSyntax?.WEB;
  if (injectedNaming.preferWebCodeSyntax) {
    const fromSyntax = extractCssNameFromWebSyntax(webSyntax);
    if (fromSyntax) return { cssName: fromSyntax, source: "web" };
  }
  const segments = [];
  if (injectedNaming.prefix) segments.push(injectedNaming.prefix);
  if (injectedNaming.includeLibraryName && libraryName) {
    segments.push(libraryName);
  }
  if (injectedNaming.includeCollectionName) {
    segments.push(record.collection.name);
  }
  segments.push(record.variable.name);
  const slug = codePointSlug(segments.join("/"));
  if (!slug) {
    throw new Error(
      `Could not create CSS name for Variable ${record.variable.id}`
    );
  }
  return { cssName: `--${slug}`, source: "derived" };
};

assertObject(injectedNaming, "injectedNaming");
for (const field of [
  "preferWebCodeSyntax",
  "includeLibraryName",
  "includeCollectionName",
]) {
  if (typeof injectedNaming[field] !== "boolean") {
    throw new Error(`injectedNaming.${field} must be a boolean`);
  }
}
if (typeof injectedNaming.prefix !== "string") {
  throw new Error("injectedNaming.prefix must be a string");
}
if (
  !Number.isInteger(maxPayloadBytes) ||
  maxPayloadBytes < 1000 ||
  maxPayloadBytes > 100000
) {
  throw new Error(`Invalid maxPayloadBytes: ${maxPayloadBytes}`);
}

if (
  typeof injectedPageListChecksum !== "string" ||
  injectedPageListChecksum.length === 0 ||
  injectedPageListChecksum === "__PAGE_LIST_CHECKSUM__"
) {
  throw new Error("injectedPageListChecksum was not configured");
}
if (!Array.isArray(injectedPageManifest)) {
  throw new Error("injectedPageManifest must be an array");
}
if (!Array.isArray(injectedDirectVariableIds)) {
  throw new Error("injectedDirectVariableIds must be an array");
}
if (!Array.isArray(injectedExplicitVariableModeCollectionIds)) {
  throw new Error(
    "injectedExplicitVariableModeCollectionIds must be an array"
  );
}

const directVariableIds = new Set();
for (const variableId of injectedDirectVariableIds) {
  if (
    typeof variableId !== "string" ||
    variableId.length === 0 ||
    directVariableIds.has(variableId)
  ) {
    throw new Error("injectedDirectVariableIds must contain unique non-empty IDs");
  }
  directVariableIds.add(variableId);
}
const sortedDirectVariableIds = [...directVariableIds].sort();
if (
  JSON.stringify(sortedDirectVariableIds) !==
  JSON.stringify(injectedDirectVariableIds)
) {
  throw new Error("injectedDirectVariableIds must be sorted");
}

const explicitVariableModeCollectionIds = new Set();
for (const collectionId of injectedExplicitVariableModeCollectionIds) {
  if (
    typeof collectionId !== "string" ||
    collectionId.length === 0 ||
    explicitVariableModeCollectionIds.has(collectionId)
  ) {
    throw new Error(
      "injectedExplicitVariableModeCollectionIds must contain unique non-empty IDs"
    );
  }
  explicitVariableModeCollectionIds.add(collectionId);
}
const sortedExplicitVariableModeCollectionIds = [
  ...explicitVariableModeCollectionIds,
].sort();
if (
  JSON.stringify(sortedExplicitVariableModeCollectionIds) !==
  JSON.stringify(injectedExplicitVariableModeCollectionIds)
) {
  throw new Error("injectedExplicitVariableModeCollectionIds must be sorted");
}

const usageErrors = [];
const scansByPageId = new Map();
let nodeCount = 0;
let nodesWithBindings = 0;
let referencedStyleCount = 0;
let referencedStylesWithBindings = 0;

for (const [position, scan] of injectedPageManifest.entries()) {
  assertObject(scan, `injectedPageManifest[${position}]`);
  if (
    scansByPageId.has(scan.id) ||
    scan.index !== position ||
    typeof scan.id !== "string" ||
    scan.id.length === 0 ||
    typeof scan.name !== "string" ||
    typeof scan.scanChecksum !== "string" ||
    scan.scanChecksum.length === 0
  ) {
    throw new Error(`Unexpected or duplicate page scan: ${scan.id}`);
  }
  scansByPageId.set(scan.id, scan);

  assertObject(scan.counts, `injectedPageManifest[${position}].counts`);
  for (const field of [
    "nodes",
    "nodesWithBindings",
    "referencedStyles",
    "referencedStylesWithBindings",
    "directVariables",
    "explicitVariableModeCollections",
    "errors",
  ]) {
    assertNonNegativeInteger(
      scan.counts[field],
      `injectedPageManifest[${position}].counts.${field}`
    );
  }
  if (scan.counts.errors !== 0) {
    throw new Error(
      `Page scan manifest contains errors and cannot be inventoried: ${scan.id}`
    );
  }

  nodeCount += scan.counts.nodes;
  nodesWithBindings += scan.counts.nodesWithBindings;
  referencedStyleCount += scan.counts.referencedStyles;
  referencedStylesWithBindings += scan.counts.referencedStylesWithBindings;
}
const orderedPageEvidence = injectedPageManifest.map((scan) => ({
  index: scan.index,
  id: scan.id,
  name: scan.name,
  scanChecksum: scan.scanChecksum,
}));

const [localCollections, enabledLibraryCollections] = await Promise.all([
  figma.variables.getLocalVariableCollectionsAsync(),
  figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync(),
]);

const localDefinedVariableIds = new Set();
for (const collection of localCollections) {
  if (!Array.isArray(collection.variableIds)) {
    throw new Error(`Local Collection has no variableIds: ${collection.id}`);
  }
  for (const variableId of collection.variableIds) {
    if (typeof variableId !== "string" || variableId.length === 0) {
      throw new Error(`Local Collection has an invalid Variable ID: ${collection.id}`);
    }
    localDefinedVariableIds.add(variableId);
  }
}

const recordsById = new Map();
const collectionsById = new Map();
const queuedIds = new Set(sortedDirectVariableIds);
const pendingIds = [...sortedDirectVariableIds];
for (let index = 0; index < pendingIds.length; index += 1) {
  const variableId = pendingIds[index];
  try {
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable) throw new Error(`Variable not found: ${variableId}`);
    let collection = collectionsById.get(variable.variableCollectionId);
    if (!collection) {
      collection = await figma.variables.getVariableCollectionByIdAsync(
        variable.variableCollectionId
      );
      if (collection) collectionsById.set(collection.id, collection);
    }
    if (!collection) {
      throw new Error(
        `Variable Collection not found: ${variable.variableCollectionId}`
      );
    }
    if (
      typeof variable.key !== "string" ||
      variable.key.length === 0 ||
      typeof collection.key !== "string" ||
      collection.key.length === 0
    ) {
      throw new Error(`Variable or Collection key is missing: ${variableId}`);
    }
    recordsById.set(variableId, { variable, collection });
    const aliasIds = new Set();
    collectVariableAliases(variable.valuesByMode, aliasIds);
    for (const aliasId of aliasIds) {
      if (queuedIds.has(aliasId)) continue;
      queuedIds.add(aliasId);
      pendingIds.push(aliasId);
    }
  } catch (error) {
    usageErrors.push({
      variableId,
      code: "VARIABLE_RESOLUTION_FAILED",
      message: formatError(error),
    });
  }
}

const records = [...recordsById.values()].sort(
  (a, b) =>
    a.variable.key.localeCompare(b.variable.key) ||
    a.variable.id.localeCompare(b.variable.id)
);
const localUsageRecords = records.filter(({ variable }) => !variable.remote);
const remoteUsageRecords = records.filter(({ variable }) => variable.remote);
const directResolvedCount = sortedDirectVariableIds.filter((id) =>
  recordsById.has(id)
).length;

const enabledByKey = new Map(
  enabledLibraryCollections.map((collection) => [collection.key, collection])
);
const usedRemoteByCollectionKey = new Map();
for (const record of remoteUsageRecords) {
  const current = usedRemoteByCollectionKey.get(record.collection.key) ?? [];
  current.push(record);
  usedRemoteByCollectionKey.set(record.collection.key, current);
}

const libraryCollections = [...usedRemoteByCollectionKey.entries()]
  .map(([collectionKey, collectionRecords]) => {
    const collection = collectionRecords[0].collection;
    const enabled = enabledByKey.get(collectionKey);
    return {
      name: collection.name,
      key: collectionKey,
      libraryName: enabled?.libraryName ?? null,
      variableCount: collectionRecords.length,
      variableIds: collectionRecords.map(({ variable }) => variable.id),
      variableIdsChecksum: variableIdChecksum(collectionRecords),
      usageChecksum: variableIdentityChecksum(collectionRecords),
      error: null,
    };
  })
  .sort(
    (a, b) =>
      (a.libraryName ?? "").localeCompare(b.libraryName ?? "") ||
      a.name.localeCompare(b.name) ||
      a.key.localeCompare(b.key)
  );

const enabledLibraryInventory = enabledLibraryCollections
  .map((collection) => ({
    name: collection.name,
    key: collection.key,
    libraryName: collection.libraryName,
    usedVariableCount: usedRemoteByCollectionKey.get(collection.key)?.length ?? 0,
  }))
  .sort(
    (a, b) =>
      (a.libraryName ?? "").localeCompare(b.libraryName ?? "") ||
      a.name.localeCompare(b.name) ||
      a.key.localeCompare(b.key)
  );

const collisionSummary = (scopeRecords) => {
  const byCssName = new Map();
  for (const record of scopeRecords) {
    const libraryName = record.variable.remote
      ? enabledByKey.get(record.collection.key)?.libraryName ?? null
      : null;
    const naming = buildCssName(record, libraryName);
    const current = byCssName.get(naming.cssName) ?? [];
    current.push(record.variable.id);
    byCssName.set(naming.cssName, current);
  }
  const collisions = [...byCssName.entries()]
    .filter(([, variableIds]) => variableIds.length > 1)
    .map(([cssName, variableIds]) => {
      const sortedVariableIds = [...variableIds].sort();
      return {
        cssName,
        variableCount: sortedVariableIds.length,
        variableIdsChecksum: checksumPayload(sortedVariableIds),
      };
    })
    .sort((a, b) => a.cssName.localeCompare(b.cssName));
  return {
    variableCount: scopeRecords.length,
    collisionCount: collisions.length,
    collisions,
  };
};
const namingPreflight = {
  config: { ...injectedNaming },
  localOnly: collisionSummary(localUsageRecords),
  complete: collisionSummary(records),
};

const usedLocalCollectionIds = new Set(
  localUsageRecords.map(({ collection }) => collection.id)
);
const warnings = [];
if (figma.root.name === "Document") {
  warnings.push({
    code: "GENERIC_FILE_NAME",
    message: 'Figma returned the generic filename "Document"; verify the target URL.',
  });
}
if (localDefinedVariableIds.size === 0) {
  warnings.push({
    code: "NO_LOCAL_VARIABLE_DEFINITIONS",
    message: "The file defines no local Variables.",
  });
}
if (sortedDirectVariableIds.length === 0) {
  warnings.push({
    code: "NO_VARIABLE_BINDINGS",
    message: "No Variable bindings were found on nodes or referenced styles.",
  });
}
for (const collection of enabledLibraryInventory) {
  if (collection.usedVariableCount === 0) {
    warnings.push({
      code: "ENABLED_LIBRARY_UNUSED",
      message:
        `Enabled Library Collection is not used by this file: ` +
        `${collection.libraryName}/${collection.name}`,
      collectionKey: collection.key,
    });
  }
}
for (const [scope, preflight] of [
  ["local-only", namingPreflight.localOnly],
  ["complete", namingPreflight.complete],
]) {
  if (preflight.collisionCount > 0) {
    warnings.push({
      code: "CSS_NAME_COLLISION_PREDICTED",
      scope,
      message:
        `${preflight.collisionCount} CSS name collision(s) are predicted for ` +
        `${scope} usage with the selected naming configuration.`,
    });
  }
}
for (const collection of libraryCollections) {
  if (!enabledByKey.has(collection.key)) {
    warnings.push({
      code: "USED_LIBRARY_NOT_ENABLED",
      message:
        `A used remote Variable Collection is not in the enabled Library list: ` +
        `${collection.name}`,
      collectionKey: collection.key,
    });
  }
}

const localVariableIds = localUsageRecords.map(({ variable }) => variable.id);
const payload = {
  schemaVersion: 2,
  kind: "figma-variable-inventory",
  generatedAt: new Date().toISOString(),
  editorType: figma.editorType,
  fileKey: sourceFileKey,
  fileName: figma.root.name,
  usage: {
    scanStrategy: "page-fan-out-bound-variables-and-referenced-styles",
    pageCount: injectedPageManifest.length,
    scannedPageCount: scansByPageId.size,
    pageListChecksum: injectedPageListChecksum,
    pageScansChecksum: checksumPayload(orderedPageEvidence),
    nodeCount,
    nodesWithBindings,
    referencedStyleCount,
    referencedStylesWithBindings,
    directVariableIdsChecksum: checksumPayload(sortedDirectVariableIds),
    directVariableCount: sortedDirectVariableIds.length,
    directResolvedVariableCount: directResolvedCount,
    aliasDependencyCount: Math.max(0, records.length - directResolvedCount),
    resolvedVariableCount: records.length,
    resolvedVariableIdsChecksum: checksumPayload(
      records.map(({ variable }) => variable.id).sort()
    ),
    explicitVariableModeCollectionIds: sortedExplicitVariableModeCollectionIds,
    checksum: variableIdentityChecksum(records),
    errors: usageErrors,
  },
  local: {
    collectionCount: usedLocalCollectionIds.size,
    variableCount: localUsageRecords.length,
    variableIds: localVariableIds,
    variableIdsChecksum: variableIdChecksum(localUsageRecords),
    usageChecksum: variableIdentityChecksum(localUsageRecords),
    definedCollectionCount: localCollections.length,
    definedVariableCount: localDefinedVariableIds.size,
  },
  libraryCollections: libraryCollections.map(({ variableIds, ...collection }) =>
    collection
  ),
  enabledLibraryCollections: enabledLibraryInventory,
  namingPreflight,
  warnings,
};

const finalizePayload = () => ({
  ...payload,
  integrity: {
    algorithm: "fnv1a32-utf16",
    checksum: checksumPayload(payload),
  },
});
let result = finalizePayload();
let payloadBytes = utf8ByteLength(JSON.stringify(result));
if (payloadBytes > maxPayloadBytes) {
  delete payload.local.variableIds;
  result = finalizePayload();
  payloadBytes = utf8ByteLength(JSON.stringify(result));
}
if (payloadBytes > maxPayloadBytes) {
  throw new Error(
    `Inventory payload exceeds maxPayloadBytes: ${payloadBytes} > ${maxPayloadBytes}`
  );
}
return result;
