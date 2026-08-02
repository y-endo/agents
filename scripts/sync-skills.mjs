import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const canonicalRoot = path.join(repositoryRoot, ".agents", "skills");
const claudeRoot = path.join(repositoryRoot, ".claude", "skills");
const checkOnly = process.argv.includes("--check");

async function listFiles(directory, relative = "") {
  const files = [];
  for (const entry of await readdir(path.join(directory, relative), {
    withFileTypes: true,
  })) {
    if (entry.name === ".DS_Store") continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(directory, child)));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files.sort();
}

async function canonicalSkillNames() {
  const names = [];
  for (const entry of await readdir(canonicalRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      await stat(path.join(canonicalRoot, entry.name, "SKILL.md"));
      names.push(entry.name);
    } catch {
      // Ignore directories that are not skills.
    }
  }
  return names.sort();
}

async function expectedFiles(skillDirectory) {
  return (await listFiles(skillDirectory)).filter(
    (relative) => relative !== "agents" && !relative.startsWith(`agents${path.sep}`)
  );
}

async function compareSkill(name) {
  const source = path.join(canonicalRoot, name);
  const destination = path.join(claudeRoot, name);
  const sourceFiles = await expectedFiles(source);
  let destinationFiles;
  try {
    destinationFiles = await listFiles(destination);
  } catch {
    return [`${name}: Claude copy is missing`];
  }
  const differences = [];
  if (sourceFiles.join("\n") !== destinationFiles.join("\n")) {
    differences.push(`${name}: file lists differ`);
  }
  for (const relative of sourceFiles) {
    try {
      const [sourceBytes, destinationBytes] = await Promise.all([
        readFile(path.join(source, relative)),
        readFile(path.join(destination, relative)),
      ]);
      if (!sourceBytes.equals(destinationBytes)) {
        differences.push(`${name}: content differs: ${relative}`);
      }
    } catch {
      differences.push(`${name}: missing Claude file: ${relative}`);
    }
  }
  return differences;
}

async function syncSkill(name) {
  const source = path.join(canonicalRoot, name);
  const destination = path.join(claudeRoot, name);
  await rm(destination, { recursive: true, force: true });
  for (const relative of await expectedFiles(source)) {
    const target = path.join(destination, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(source, relative), target);
  }
}

const names = await canonicalSkillNames();
if (checkOnly) {
  const differences = (
    await Promise.all(names.map((name) => compareSkill(name)))
  ).flat();
  if (differences.length > 0) {
    console.error(differences.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Claude skill copies are synchronized (${names.length} skill(s)).`);
  }
} else {
  await mkdir(claudeRoot, { recursive: true });
  for (const name of names) {
    await syncSkill(name);
  }
  console.log(`Synchronized ${names.length} skill(s) to .claude/skills.`);
}
