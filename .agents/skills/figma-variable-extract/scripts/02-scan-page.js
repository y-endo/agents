// Figma Remote MCP / use_figma 用
// 実行前にsourceFileKeyとtargetPageのプレースホルダーを置換すること。

const sourceFileKey = "__FILE_KEY__";
const targetPage = __TARGET_PAGE__;

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
if (
  !targetPage ||
  typeof targetPage !== "object" ||
  !Number.isInteger(targetPage.index) ||
  targetPage.index < 0 ||
  typeof targetPage.id !== "string" ||
  targetPage.id.length === 0 ||
  typeof targetPage.name !== "string"
) {
  throw new Error("targetPage was not configured");
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
const safeGet = (target, field) => {
  try {
    return target[field];
  } catch {
    return undefined;
  }
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

const page = await figma.getNodeByIdAsync(targetPage.id);
if (!page || page.type !== "PAGE") {
  throw new Error(`Target page was not found: ${targetPage.id}`);
}
if (page.name !== targetPage.name) {
  throw new Error(
    `Target page name changed: expected ${targetPage.name}, got ${page.name}`
  );
}

await figma.setCurrentPageAsync(page);

const directVariableIds = new Set();
const explicitVariableModeCollectionIds = new Set();
const referencedStyleIds = new Set();
let nodesWithBindings = 0;
const nodes = page.findAll();

for (const node of nodes) {
  const nodeVariableIds = new Set();
  collectVariableAliases(safeGet(node, "boundVariables"), nodeVariableIds);
  if (nodeVariableIds.size > 0) nodesWithBindings += 1;
  for (const variableId of nodeVariableIds) directVariableIds.add(variableId);

  for (const field of [
    "fillStyleId",
    "strokeStyleId",
    "effectStyleId",
    "gridStyleId",
    "textStyleId",
  ]) {
    const styleId = safeGet(node, field);
    if (typeof styleId === "string" && styleId.length > 0) {
      referencedStyleIds.add(styleId);
    }
  }

  const explicitVariableModes = safeGet(node, "explicitVariableModes");
  if (explicitVariableModes && typeof explicitVariableModes === "object") {
    for (const collectionId of Object.keys(explicitVariableModes)) {
      explicitVariableModeCollectionIds.add(collectionId);
    }
  }
}

const errors = [];
let referencedStylesWithBindings = 0;
for (const styleId of [...referencedStyleIds].sort()) {
  try {
    const style = await figma.getStyleByIdAsync(styleId);
    if (!style) {
      throw new Error(`Referenced Style not found: ${styleId}`);
    }
    const styleVariableIds = new Set();
    collectVariableAliases(safeGet(style, "boundVariables"), styleVariableIds);
    if (styleVariableIds.size > 0) referencedStylesWithBindings += 1;
    for (const variableId of styleVariableIds) directVariableIds.add(variableId);
  } catch (error) {
    errors.push({
      code: "STYLE_RESOLUTION_FAILED",
      styleId,
      message: formatError(error),
    });
  }
}

const sortedDirectVariableIds = [...directVariableIds].sort();
const payload = {
  schemaVersion: 2,
  kind: "figma-variable-page-scan",
  generatedAt: new Date().toISOString(),
  editorType: figma.editorType,
  fileKey: sourceFileKey,
  fileName: figma.root.name,
  page: {
    index: targetPage.index,
    id: page.id,
    name: page.name,
  },
  counts: {
    nodes: nodes.length,
    nodesWithBindings,
    referencedStyles: referencedStyleIds.size,
    referencedStylesWithBindings,
    directVariables: sortedDirectVariableIds.length,
    explicitVariableModeCollections: explicitVariableModeCollectionIds.size,
    errors: errors.length,
  },
  directVariableIds: sortedDirectVariableIds,
  explicitVariableModeCollectionIds: [
    ...explicitVariableModeCollectionIds,
  ].sort(),
  errors,
};

return {
  ...payload,
  integrity: {
    algorithm: "fnv1a32-utf16",
    checksum: checksumPayload(payload),
  },
};
