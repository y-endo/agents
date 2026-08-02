// Figma Remote MCP / use_figma 用
// 実行前にsourceFileKeyのプレースホルダーを置換すること。

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

const pages = figma.root.children.map((page, index) => {
  if (page.type !== "PAGE") {
    throw new Error(`Document child is not a PAGE: ${page.id}`);
  }
  return {
    index,
    id: page.id,
    name: page.name,
  };
});

const pageIds = new Set();
for (const page of pages) {
  if (
    typeof page.id !== "string" ||
    page.id.length === 0 ||
    pageIds.has(page.id)
  ) {
    throw new Error(`Invalid or duplicate page ID: ${page.id}`);
  }
  pageIds.add(page.id);
}

const payload = {
  schemaVersion: 2,
  kind: "figma-variable-page-list",
  generatedAt: new Date().toISOString(),
  editorType: figma.editorType,
  fileKey: sourceFileKey,
  fileName: figma.root.name,
  pageCount: pages.length,
  pages,
};

return {
  ...payload,
  integrity: {
    algorithm: "fnv1a32-utf16",
    checksum: checksumPayload(payload),
  },
};
