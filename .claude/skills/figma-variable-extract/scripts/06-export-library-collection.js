// Figma Remote MCP / use_figma 用
// 実行前に確定済みExport計画のLibrary ID、Collection、チェックサム、ページング値を置換すること。

const sourceFileKey = "__FILE_KEY__";
const injectedVariableIds = __VARIABLE_IDS__;
const expectedVariableIdsChecksum = "__VARIABLE_IDS_CHECKSUM__";
const expectedUsageChecksum = "__USAGE_CHECKSUM__";
const expectedDirectVariableIdsChecksum = "__DIRECT_VARIABLE_IDS_CHECKSUM__";
const collectionKey = "__COLLECTION_KEY__";
const expectedLibraryName = __LIBRARY_NAME__;
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
if (typeof collectionKey !== "string" || collectionKey.length === 0) {
  throw new Error("Invalid collectionKey");
}
if (expectedLibraryName !== null && typeof expectedLibraryName !== "string") {
  throw new Error("expectedLibraryName must be a string or null");
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
if (!Array.isArray(injectedVariableIds)) {
  throw new Error("injectedVariableIds must be an array");
}
const variableIdSet = new Set();
for (const variableId of injectedVariableIds) {
  if (
    typeof variableId !== "string" ||
    variableId.length === 0 ||
    variableIdSet.has(variableId)
  ) {
    throw new Error(`Invalid or duplicate Variable ID: ${variableId}`);
  }
  variableIdSet.add(variableId);
}
if (
  typeof expectedVariableIdsChecksum !== "string" ||
  expectedVariableIdsChecksum.length === 0 ||
  expectedVariableIdsChecksum === "__VARIABLE_IDS_CHECKSUM__" ||
  checksumPayload(injectedVariableIds) !== expectedVariableIdsChecksum
) {
  throw new Error("Variable ID plan checksum mismatch");
}
for (const [label, value, placeholder] of [
  ["usage", expectedUsageChecksum, "__USAGE_CHECKSUM__"],
  [
    "direct Variable ID",
    expectedDirectVariableIdsChecksum,
    "__DIRECT_VARIABLE_IDS_CHECKSUM__",
  ],
]) {
  if (typeof value !== "string" || value.length === 0 || value === placeholder) {
    throw new Error(`Expected ${label} checksum was not configured`);
  }
}
if (startIndex > injectedVariableIds.length) {
  throw new Error(
    `startIndex exceeds the Library Export plan: ${startIndex} > ` +
      `${injectedVariableIds.length}`
  );
}

const serializeCodeSyntax = (codeSyntax) =>
  Object.fromEntries(
    Object.entries(codeSyntax ?? {}).filter(
      ([, value]) => typeof value === "string" && value.length > 0
    )
  );
const serializeVariable = (variable) => ({
  id: variable.id,
  key: variable.key,
  name: variable.name,
  description: variable.description,
  resolvedType: variable.resolvedType,
  remote: variable.remote,
  variableCollectionId: variable.variableCollectionId,
  scopes: [...(variable.scopes ?? [])],
  codeSyntax: serializeCodeSyntax(variable.codeSyntax),
  hiddenFromPublishing: variable.hiddenFromPublishing,
  valuesByMode: { ...(variable.valuesByMode ?? {}) },
});
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

const generatedAt = new Date().toISOString();
let resolvedCollection = null;
const records = [];
const buildResult = (batchRecords) => {
  const collection = batchRecords[0]?.collection ?? resolvedCollection;
  const nextStartIndex = startIndex + batchRecords.length;
  const payload = {
    schemaVersion: 2,
    kind: "figma-variable-export",
    generatedAt,
    source: {
      type: "library",
      fileKey: sourceFileKey,
      fileName: figma.root.name,
      libraryName: expectedLibraryName,
      libraryCollectionName: collection?.name ?? null,
      libraryCollectionKey: collectionKey,
      directVariableIdsChecksum: expectedDirectVariableIdsChecksum,
      variableIdsChecksum: expectedVariableIdsChecksum,
      usageChecksum: expectedUsageChecksum,
      batchUsageChecksum: variableIdentityChecksum(batchRecords),
    },
    collections: collection
      ? [
          {
            id: collection.id,
            key: collection.key,
            name: collection.name,
            libraryName: expectedLibraryName,
            remote: true,
            hiddenFromPublishing: collection.hiddenFromPublishing,
            defaultModeId: collection.defaultModeId,
            modes: collection.modes.map((mode) => ({
              modeId: mode.modeId,
              name: mode.name,
            })),
            variables: batchRecords.map(({ variable }) =>
              serializeVariable(variable)
            ),
          },
        ]
      : [],
    pagination: {
      total: injectedVariableIds.length,
      startIndex,
      batchSize,
      maxPayloadBytes,
      returnedDescriptorCount: batchRecords.length,
      successCount: batchRecords.length,
      errorCount: 0,
      nextStartIndex,
      hasMore: nextStartIndex < injectedVariableIds.length,
    },
    errors: [],
  };
  return {
    ...payload,
    integrity: {
      algorithm: "fnv1a32-utf16",
      checksum: checksumPayload(payload),
    },
  };
};

const endIndex = Math.min(
  injectedVariableIds.length,
  startIndex + batchSize
);
for (let index = startIndex; index < endIndex; index += 1) {
  const variableId = injectedVariableIds[index];
  const variable = await figma.variables.getVariableByIdAsync(variableId);
  if (!variable) throw new Error(`Variable not found: ${variableId}`);
  if (!variable.remote) {
    throw new Error(`Local Variable found in Library Export plan: ${variableId}`);
  }
  if (!resolvedCollection) {
    resolvedCollection = await figma.variables.getVariableCollectionByIdAsync(
      variable.variableCollectionId
    );
    if (!resolvedCollection) {
      throw new Error(
        `Variable Collection not found: ${variable.variableCollectionId}`
      );
    }
  }
  if (
    variable.variableCollectionId !== resolvedCollection.id ||
    resolvedCollection.key !== collectionKey
  ) {
    throw new Error(`Variable is outside the requested Collection: ${variableId}`);
  }
  if (
    typeof variable.key !== "string" ||
    variable.key.length === 0 ||
    typeof resolvedCollection.key !== "string" ||
    resolvedCollection.key.length === 0
  ) {
    throw new Error(`Variable or Collection key is missing: ${variableId}`);
  }
  const candidate = [
    ...records,
    { variable, collection: resolvedCollection },
  ];
  const candidateResult = buildResult(candidate);
  if (utf8ByteLength(JSON.stringify(candidateResult)) > maxPayloadBytes) {
    if (records.length === 0) {
      throw new Error(
        `A single Library Variable exceeds maxPayloadBytes: ${variableId}`
      );
    }
    break;
  }
  records.push({ variable, collection: resolvedCollection });
}

const result = buildResult(records);
if (utf8ByteLength(JSON.stringify(result)) > maxPayloadBytes) {
  throw new Error("Library Export payload exceeds maxPayloadBytes");
}
return result;
