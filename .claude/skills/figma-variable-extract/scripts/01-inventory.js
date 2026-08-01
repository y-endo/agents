// Figma Remote MCP / use_figma 用
// top-level await と return を使う。async IIFEやfigma.closePlugin()は不要。

const sourceFileKey = "__FILE_KEY__";

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

const [localCollections, localVariables, libraryCollections] = await Promise.all([
  figma.variables.getLocalVariableCollectionsAsync(),
  figma.variables.getLocalVariablesAsync(),
  figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync(),
]);

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
const libraryInventory = [];

for (const collection of libraryCollections) {
  try {
    const variables =
      await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);

    libraryInventory.push({
      name: collection.name,
      key: collection.key,
      libraryName: collection.libraryName,
      variableCount: variables.length,
      error: null,
    });
  } catch (error) {
    libraryInventory.push({
      name: collection.name,
      key: collection.key,
      libraryName: collection.libraryName,
      variableCount: null,
      error: formatError(error),
    });
  }
}

const payload = {
  schemaVersion: 1,
  kind: "figma-variable-inventory",
  generatedAt: new Date().toISOString(),
  editorType: figma.editorType,
  fileKey: sourceFileKey,
  fileName: figma.root.name,
  local: {
    collectionCount: localCollections.length,
    variableCount: localVariables.length,
    collections: localCollections.map((collection) => ({
      id: collection.id,
      key: collection.key,
      name: collection.name,
      defaultModeId: collection.defaultModeId,
      modes: collection.modes.map((mode) => ({
        modeId: mode.modeId,
        name: mode.name,
      })),
      variableCount: collection.variableIds.length,
    })),
  },
  libraryCollections: libraryInventory,
};

return {
  ...payload,
  integrity: {
    algorithm: "fnv1a32-utf16",
    checksum: checksumPayload(payload),
  },
};
