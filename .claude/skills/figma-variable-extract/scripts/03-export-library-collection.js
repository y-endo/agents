// Figma Remote MCP / use_figma 用
// 実行前にsourceFileKey、collectionKey、startIndex、batchSizeのプレースホルダーを置換すること。

const sourceFileKey = "__FILE_KEY__";
const collectionKey = "__COLLECTION_KEY__";
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
if (
  typeof collectionKey !== "string" ||
  collectionKey.length === 0
) {
  throw new Error("Invalid collectionKey");
}
if (!Number.isInteger(startIndex) || startIndex < 0) {
  throw new Error(`Invalid startIndex: ${startIndex}`);
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 200) {
  throw new Error(`Invalid batchSize: ${batchSize}`);
}

const availableCollections =
  await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
const matchingCollections = availableCollections.filter(
  (collection) => collection.key === collectionKey
);

if (matchingCollections.length === 0) {
  throw new Error(
    `Library Variable Collection not found or not enabled: ${collectionKey}`
  );
}
if (matchingCollections.length > 1) {
  throw new Error(`Duplicate Library Variable Collection key: ${collectionKey}`);
}

const libraryCollection = matchingCollections[0];
const descriptors =
  await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collectionKey);
const descriptorKeys = new Set();

for (const descriptor of descriptors) {
  if (
    typeof descriptor.key !== "string" ||
    descriptor.key.length === 0 ||
    descriptorKeys.has(descriptor.key)
  ) {
    throw new Error(`Invalid or duplicate Library Variable key: ${descriptor.key}`);
  }
  descriptorKeys.add(descriptor.key);
}

const batch = descriptors.slice(startIndex, startIndex + batchSize);
const importedVariables = [];
const errors = [];
let importedCollection = null;

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

for (const descriptor of batch) {
  try {
    const variable = await figma.variables.importVariableByKeyAsync(descriptor.key);

    if (variable.key !== descriptor.key) {
      throw new Error(
        `Imported Variable key mismatch: expected ${descriptor.key}, got ${variable.key}`
      );
    }
    if (variable.resolvedType !== descriptor.resolvedType) {
      throw new Error(
        `Imported Variable type mismatch for ${descriptor.key}: ` +
          `expected ${descriptor.resolvedType}, got ${variable.resolvedType}`
      );
    }

    if (!importedCollection) {
      importedCollection = await figma.variables.getVariableCollectionByIdAsync(
        variable.variableCollectionId
      );
      if (!importedCollection) {
        throw new Error(
          `Imported Variable Collection not found: ${variable.variableCollectionId}`
        );
      }
    } else if (variable.variableCollectionId !== importedCollection.id) {
      throw new Error(
        `Imported Variable Collection mismatch for ${descriptor.key}: ` +
          `expected ${importedCollection.id}, got ${variable.variableCollectionId}`
      );
    }

    importedVariables.push(serializeVariable(variable));
  } catch (error) {
    errors.push({
      key: descriptor.key,
      name: descriptor.name,
      resolvedType: descriptor.resolvedType,
      message: formatError(error),
    });
  }
}

const endIndexExclusive = startIndex + batch.length;

const payload = {
  schemaVersion: 1,
  kind: "figma-variable-export",
  generatedAt: new Date().toISOString(),
  source: {
    type: "library",
    fileKey: sourceFileKey,
    fileName: figma.root.name,
    libraryName: libraryCollection.libraryName,
    libraryCollectionName: libraryCollection.name,
    libraryCollectionKey: libraryCollection.key,
  },
  collections: [
    {
      id: importedCollection?.id ?? null,
      key: libraryCollection.key,
      name: libraryCollection.name,
      libraryName: libraryCollection.libraryName,
      remote: true,
      hiddenFromPublishing: importedCollection?.hiddenFromPublishing ?? null,
      defaultModeId: importedCollection?.defaultModeId ?? null,
      modes:
        importedCollection?.modes.map((mode) => ({
          modeId: mode.modeId,
          name: mode.name,
        })) ?? [],
      variables: importedVariables,
    },
  ],
  pagination: {
    total: descriptors.length,
    startIndex,
    batchSize,
    returnedDescriptorCount: batch.length,
    successCount: importedVariables.length,
    errorCount: errors.length,
    nextStartIndex: endIndexExclusive,
    hasMore: endIndexExclusive < descriptors.length,
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
