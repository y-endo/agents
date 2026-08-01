import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readlink,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  if (result.error) {
    throw new Error(
      `${command} could not be executed: ${result.error.message}`
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} exited with status ${result.status}\n` +
        `${result.stdout}${result.stderr}`
    );
  }
  return result;
}

const temporaryRoot = await mkdtemp(
  path.join(os.tmpdir(), "figma-token-publish-scan-")
);
try {
  const temporaryRepository = path.join(temporaryRoot, "repository");
  run("git", ["init", "--quiet", temporaryRepository]);
  const gitEnvironment = {
    ...process.env,
    GIT_DIR: path.join(temporaryRepository, ".git"),
    GIT_WORK_TREE: repositoryRoot,
  };
  run("git", ["add", "--all"], { env: gitEnvironment });
  const listed = run("git", ["ls-files", "-z"], {
    env: gitEnvironment,
    encoding: "buffer",
  }).stdout;
  const files = listed
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const scanRoot = path.join(temporaryRoot, "publishable");
  for (const relative of files) {
    const source = path.join(repositoryRoot, relative);
    const destination = path.join(scanRoot, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    const metadata = await lstat(source);
    if (metadata.isSymbolicLink()) {
      await writeFile(destination, await readlink(source), "utf8");
    } else if (metadata.isFile()) {
      await copyFile(source, destination);
    }
  }
  run("gitleaks", ["dir", scanRoot, "--no-banner", "--redact"]);
  console.log(`Publishable source scan passed (${files.length} file(s)).`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
