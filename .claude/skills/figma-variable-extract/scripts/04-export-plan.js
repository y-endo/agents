// Figma Remote MCP / use_figma 用
// 実行前にInventory要約、direct ID集合、選択scope、ページング値を置換すること。

const sourceFileKey = "__FILE_KEY__";
const injectedDirectVariableIds = __DIRECT_VARIABLE_IDS__;
const expectedUsage = __EXPECTED_USAGE__;
const expectedLocal = __EXPECTED_LOCAL__;
const expectedLibraryCollections = __EXPECTED_LIBRARY_COLLECTIONS__;
const selectedScope = "__SELECTED_SCOPE__";
const startIndex = __START_INDEX__;
const batchSize = __BATCH_SIZE__;
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
if (selectedScope !== "local-only" && selectedScope !== "complete") {
  throw new Error(`Invalid selectedScope: ${selectedScope}`);
}
if (!Number.isInteger(startIndex) || startIndex < 0) {
  throw new Error(`Invalid startIndex: ${startIndex}`);
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 200) {
  throw new Error(`Invalid batchSize: ${batchSize}`);
}
if (
  !Number.isInteger(maxPayloadBytes) ||
  maxPayloadBytes < 1000 ||
  maxPayloadBytes > 100000
) {
  throw new Error(`Invalid maxPayloadBytes: ${maxPayloadBytes}`);
}

const assertObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
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

assertObject(expectedUsage, "expectedUsage");
assertObject(expectedLocal, "expectedLocal");
if (!Array.isArray(expectedLibraryCollections)) {
  throw new Error("expectedLibraryCollections must be an array");
}
if (!Array.isArray(injectedDirectVariableIds)) {
  throw new Error("injectedDirectVariableIds must be an array");
}
const directVariableIds = new Set();
for (const variableId of injectedDirectVariableIds) {
  if (
    typeof variableId !== "string" ||
    variableId.length === 0 ||
    directVariableIds.has(variableId)
  ) {
    throw new Error(`Invalid or duplicate direct Variable ID: ${variableId}`);
  }
  directVariableIds.add(variableId);
}
if (
  JSON.stringify([...directVariableIds].sort()) !==
  JSON.stringify(injectedDirectVariableIds) ||
  checksumPayload(injectedDirectVariableIds) !==
    expectedUsage.directVariableIdsChecksum ||
  injectedDirectVariableIds.length !== expectedUsage.directVariableCount
) {
  throw new Error("Direct Variable ID manifest changed after Inventory");
}

const recordsById = new Map();
const collectionsById = new Map();
const queuedIds = new Set(injectedDirectVariableIds);
const pendingIds = [...injectedDirectVariableIds];
for (let index = 0; index < pendingIds.length; index += 1) {
  const variableId = pendingIds[index];
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
}

const records = [...recordsById.values()].sort(
  (a, b) =>
    a.variable.key.localeCompare(b.variable.key) ||
    a.variable.id.localeCompare(b.variable.id)
);
if (
  records.length !== expectedUsage.resolvedVariableCount ||
  checksumPayload(records.map(({ variable }) => variable.id).sort()) !==
    expectedUsage.resolvedVariableIdsChecksum ||
  variableIdentityChecksum(records) !== expectedUsage.checksum
) {
  throw new Error("Complete usage closure changed after Inventory");
}

const localRecords = records.filter(({ variable }) => !variable.remote);
if (
  localRecords.length !== expectedLocal.variableCount ||
  variableIdChecksum(localRecords) !== expectedLocal.variableIdsChecksum ||
  variableIdentityChecksum(localRecords) !== expectedLocal.usageChecksum
) {
  throw new Error("Local usage set changed after Inventory");
}

const remoteByCollectionKey = new Map();
for (const record of records.filter(({ variable }) => variable.remote)) {
  const current = remoteByCollectionKey.get(record.collection.key) ?? [];
  current.push(record);
  remoteByCollectionKey.set(record.collection.key, current);
}
if (remoteByCollectionKey.size !== expectedLibraryCollections.length) {
  throw new Error("Used Library Collection set changed after Inventory");
}

const groups = [];
const plannedVariableIds = [];
const appendGroup = (group, groupRecords) => {
  const variableIds = groupRecords.map(({ variable }) => variable.id);
  const start = plannedVariableIds.length;
  plannedVariableIds.push(...variableIds);
  groups.push({
    ...group,
    startIndex: start,
    variableCount: variableIds.length,
    variableIdsChecksum: checksumPayload(variableIds),
    usageChecksum: variableIdentityChecksum(groupRecords),
  });
};
appendGroup({ type: "local" }, localRecords);
if (selectedScope === "complete") {
  for (const [index, expected] of expectedLibraryCollections.entries()) {
    assertObject(expected, `expectedLibraryCollections[${index}]`);
    const groupRecords = remoteByCollectionKey.get(expected.key);
    if (
      !groupRecords ||
      groupRecords[0].collection.name !== expected.name ||
      groupRecords.length !== expected.variableCount ||
      variableIdChecksum(groupRecords) !== expected.variableIdsChecksum ||
      variableIdentityChecksum(groupRecords) !== expected.usageChecksum
    ) {
      throw new Error(`Library usage set changed after Inventory: ${expected.key}`);
    }
    appendGroup(
      {
        type: "library",
        key: expected.key,
        name: expected.name,
        libraryName: expected.libraryName,
      },
      groupRecords
    );
  }
}
if (startIndex > plannedVariableIds.length) {
  throw new Error(
    `startIndex ${startIndex} exceeds plan size ${plannedVariableIds.length}`
  );
}

const generatedAt = new Date().toISOString();
const planChecksum = checksumPayload(plannedVariableIds);
const buildResult = (variableIds) => {
  const nextStartIndex = startIndex + variableIds.length;
  const payload = {
    schemaVersion: 2,
    kind: "figma-variable-export-plan",
    generatedAt,
    source: {
      fileKey: sourceFileKey,
      fileName: figma.root.name,
      scope: selectedScope,
      directVariableIdsChecksum: expectedUsage.directVariableIdsChecksum,
      usageChecksum: expectedUsage.checksum,
      resolvedVariableIdsChecksum: expectedUsage.resolvedVariableIdsChecksum,
      planChecksum,
    },
    groups,
    variableIds,
    pagination: {
      total: plannedVariableIds.length,
      startIndex,
      batchSize,
      maxPayloadBytes,
      returnedCount: variableIds.length,
      nextStartIndex,
      hasMore: nextStartIndex < plannedVariableIds.length,
      batchIdentityChecksum: checksumPayload(variableIds),
    },
  };
  return {
    ...payload,
    integrity: {
      algorithm: "fnv1a32-utf16",
      checksum: checksumPayload(payload),
    },
  };
};

const variableIds = [];
const endIndex = Math.min(plannedVariableIds.length, startIndex + batchSize);
for (let index = startIndex; index < endIndex; index += 1) {
  const candidate = [...variableIds, plannedVariableIds[index]];
  if (utf8ByteLength(JSON.stringify(buildResult(candidate))) > maxPayloadBytes) {
    if (variableIds.length === 0) {
      throw new Error(
        `A single Export-plan ID exceeds maxPayloadBytes: ${plannedVariableIds[index]}`
      );
    }
    break;
  }
  variableIds.push(plannedVariableIds[index]);
}
const result = buildResult(variableIds);
if (utf8ByteLength(JSON.stringify(result)) > maxPayloadBytes) {
  throw new Error("Export-plan payload exceeds maxPayloadBytes");
}
return result;
