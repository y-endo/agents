// Figma Remote MCP / use_figma 用
// 実行前にsourceFileKey、startIndex、batchSizeのプレースホルダーを置換すること。

const sourceFileKey = "__FILE_KEY__";
const startIndex = __START_INDEX__;
const batchSize = __BATCH_SIZE__;

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
if (!Number.isInteger(startIndex) || startIndex < 0) {
  throw new Error(`Invalid startIndex: ${startIndex}`);
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 200) {
  throw new Error(`Invalid batchSize: ${batchSize}`);
}

const [collections, variables] = await Promise.all([
  figma.variables.getLocalVariableCollectionsAsync(),
  figma.variables.getLocalVariablesAsync(),
]);

const collectionIds = new Set(collections.map((collection) => collection.id));
const batch = variables.slice(startIndex, startIndex + batchSize);
const variablesByCollectionId = new Map();
const errors = [];

const formatError = (error) => (error instanceof Error ? error.message : String(error));
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

for (const variable of batch) {
  try {
    if (!collectionIds.has(variable.variableCollectionId)) {
      throw new Error(
        `Local Variable references an unknown collection: ${variable.variableCollectionId}`
      );
    }

    const current = variablesByCollectionId.get(variable.variableCollectionId) ?? [];
    current.push(serializeVariable(variable));
    variablesByCollectionId.set(variable.variableCollectionId, current);
  } catch (error) {
    errors.push({
      key: variable.key,
      name: variable.name,
      resolvedType: variable.resolvedType,
      message: formatError(error),
    });
  }
}

const endIndexExclusive = startIndex + batch.length;
const successCount = batch.length - errors.length;

const payload = {
  schemaVersion: 1,
  kind: "figma-variable-export",
  generatedAt: new Date().toISOString(),
  source: {
    type: "local",
    fileKey: sourceFileKey,
    fileName: figma.root.name,
  },
  collections: collections.map((collection) => ({
    id: collection.id,
    key: collection.key,
    name: collection.name,
    remote: collection.remote,
    hiddenFromPublishing: collection.hiddenFromPublishing,
    defaultModeId: collection.defaultModeId,
    modes: collection.modes.map((mode) => ({
      modeId: mode.modeId,
      name: mode.name,
    })),
    variables: variablesByCollectionId.get(collection.id) ?? [],
  })),
  pagination: {
    total: variables.length,
    startIndex,
    batchSize,
    returnedDescriptorCount: batch.length,
    successCount,
    errorCount: errors.length,
    nextStartIndex: endIndexExclusive,
    hasMore: endIndexExclusive < variables.length,
  },
  errors,
};

return {
  ...payload,
  integrity: {
    algorithm: "fnv1a32-utf16",
    checksum: checksumPayload(payload),
  },
};
