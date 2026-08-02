const jsTsExtensions = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);

const regexPrefixKeywords = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "instanceof",
  "new",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);

const regexPrefixPunctuation = new Set([
  "(",
  "[",
  "{",
  ",",
  ";",
  ":",
  "=",
  "!",
  "?",
  "&",
  "|",
  "+",
  "-",
  "*",
  "%",
  "^",
  "~",
  "<",
  ">",
]);

function isIdentifierStart(character) {
  return /[A-Za-z_$]/.test(character ?? "");
}

function isIdentifierPart(character) {
  return /[A-Za-z0-9_$]/.test(character ?? "");
}

function canStartRegex(previous) {
  if (!previous) return true;
  if (previous.type === "identifier") return regexPrefixKeywords.has(previous.value);
  return previous.type === "punctuation" && regexPrefixPunctuation.has(previous.value);
}

function readQuoted(source, start, quote) {
  let index = start + 1;
  let value = "";
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      const next = source[index + 1];
      if (next !== undefined) value += next;
      index += 2;
      continue;
    }
    if (character === quote) return { end: index + 1, value };
    value += character;
    index += 1;
  }
  return { end: source.length, value };
}

function readTemplate(source, start) {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === "`") return index + 1;
    index += 1;
  }
  return source.length;
}

function readRegex(source, start) {
  let index = start + 1;
  let inCharacterClass = false;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "[") inCharacterClass = true;
    if (character === "]") inCharacterClass = false;
    if (character === "/" && !inCharacterClass) {
      index += 1;
      while (/[A-Za-z]/.test(source[index] ?? "")) index += 1;
      return index;
    }
    if (character === "\n" || character === "\r") return index;
    index += 1;
  }
  return source.length;
}

export function isJsTsPath(filePath) {
  return jsTsExtensions.has(filePath.slice(filePath.lastIndexOf(".")).toLowerCase());
}

export function tokenizeJsTs(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      index = source.indexOf("\n", index + 2);
      if (index === -1) break;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (character === "'" || character === '"') {
      const quoted = readQuoted(source, index, character);
      tokens.push({ type: "string", value: quoted.value, start: index, end: quoted.end });
      index = quoted.end;
      continue;
    }
    if (character === "`") {
      index = readTemplate(source, index);
      continue;
    }
    if (character === "/" && canStartRegex(tokens.at(-1))) {
      index = readRegex(source, index);
      continue;
    }
    if (isIdentifierStart(character)) {
      const start = index;
      index += 1;
      while (isIdentifierPart(source[index])) index += 1;
      tokens.push({ type: "identifier", value: source.slice(start, index), start, end: index });
      continue;
    }
    tokens.push({ type: "punctuation", value: character, start: index, end: index + 1 });
    index += 1;
  }
  return tokens;
}

export function stripJsTsComments(source) {
  const characters = [...source];
  let index = 0;
  let previous;
  while (index < source.length) {
    const character = source[index];
    if (character === "'" || character === '"') {
      index = readQuoted(source, index, character).end;
      previous = { type: "string", value: "" };
      continue;
    }
    if (character === "`") {
      index = readTemplate(source, index);
      previous = { type: "string", value: "" };
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      const end = source.indexOf("\n", index + 2);
      const stop = end === -1 ? source.length : end;
      for (let cursor = index; cursor < stop; cursor += 1) characters[cursor] = " ";
      index = stop;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      for (let cursor = index; cursor < stop; cursor += 1) {
        if (characters[cursor] !== "\n" && characters[cursor] !== "\r") characters[cursor] = " ";
      }
      index = stop;
      continue;
    }
    if (character === "/" && canStartRegex(previous)) {
      index = readRegex(source, index);
      previous = { type: "regex", value: "" };
      continue;
    }
    if (isIdentifierStart(character)) {
      const start = index;
      index += 1;
      while (isIdentifierPart(source[index])) index += 1;
      previous = { type: "identifier", value: source.slice(start, index) };
      continue;
    }
    if (!/\s/.test(character)) previous = { type: "punctuation", value: character };
    index += 1;
  }
  return characters.join("");
}

export function hasDeclaration(tokens, symbol) {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if (
      token.type === "identifier" &&
      ["function", "class", "interface", "type", "enum", "namespace"].includes(token.value) &&
      next?.type === "identifier" &&
      next.value === symbol
    ) {
      return true;
    }
    if (token.type === "identifier" && ["const", "let", "var"].includes(token.value)) {
      for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
        const candidate = tokens[cursor];
        if (candidate.value === ";") break;
        if (candidate.type === "identifier" && candidate.value === symbol) return true;
      }
    }
  }
  return false;
}

export function hasImport(tokens, symbol, importFrom) {
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].type !== "identifier" || tokens[index].value !== "import") continue;
    let sourceIndex = index + 1;
    while (sourceIndex < tokens.length && tokens[sourceIndex].value !== ";") {
      if (tokens[sourceIndex].type === "string") break;
      sourceIndex += 1;
    }
    const source = tokens[sourceIndex];
    if (source?.type !== "string" || source.value !== importFrom) continue;
    const clause = tokens.slice(index + 1, sourceIndex);
    if (clause.some((token) => token.type === "identifier" && token.value === symbol)) return true;
  }
  return false;
}

export function hasJsxUsage(tokens, symbol) {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (
      tokens[index].value === "<" &&
      tokens[index + 1].type === "identifier" &&
      tokens[index + 1].value === symbol
    ) {
      return true;
    }
  }
  return false;
}

export function findInteractiveJsx(tokens) {
  const elements = [];
  const destinations = [];
  const fragmentTargets = [];
  const staticIds = new Set();
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index].value !== "<" || tokens[index + 1].type !== "identifier") continue;
    const tag = tokens[index + 1].value;
    const afterTag = tokens[index + 2];
    if (
      afterTag &&
      afterTag.type !== "identifier" &&
      ![">", "/", "{"].includes(afterTag.value)
    ) {
      continue;
    }
    let cursor = index + 2;
    let interactive = ["a", "button", "input", "select", "textarea"].includes(tag);
    while (cursor < tokens.length && tokens[cursor].value !== ">") {
      const attribute = tokens[cursor];
      const equals = tokens[cursor + 1];
      const value = tokens[cursor + 2];
      if (attribute?.type === "identifier") {
        if (attribute.value === "href" || attribute.value === "to" || /^on[A-Z]/.test(attribute.value)) {
          interactive = true;
        }
        if (equals?.value === "=" && value?.type === "string") {
          if (attribute.value === "id") staticIds.add(value.value);
          if (["href", "to"].includes(attribute.value)) {
            destinations.push(value.value);
          }
          if (
            ["href", "to"].includes(attribute.value) &&
            (value.value === "" || value.value === "#" || /^#[A-Za-z][\w:-]*$/.test(value.value))
          ) {
            fragmentTargets.push(value.value.slice(1));
          }
        }
      }
      cursor += 1;
    }
    if (interactive) elements.push(tag);
    index = cursor;
  }
  return { elements, destinations, fragmentTargets, staticIds };
}

export function findStaticLinkValues(tokens) {
  const destinations = [];
  const fragmentTargets = [];
  for (let index = 0; index < tokens.length - 2; index += 1) {
    const property = tokens[index];
    const separator = tokens[index + 1];
    const value = tokens[index + 2];
    if (
      property.type !== "identifier" ||
      !["href", "to"].includes(property.value) ||
      !["=", ":"].includes(separator.value) ||
      value.type !== "string"
    ) {
      continue;
    }
    if (
      property.value === "to" &&
      separator.value === ":" &&
      value.value !== "" &&
      !/^(#|\/|https?:|mailto:|tel:|\.\.?\/)/.test(value.value)
    ) {
      continue;
    }
    destinations.push(value.value);
    if (value.value === "" || value.value === "#" || /^#[A-Za-z][\w:-]*$/.test(value.value)) {
      fragmentTargets.push(value.value.slice(1));
    }
  }
  return { destinations, fragmentTargets };
}
