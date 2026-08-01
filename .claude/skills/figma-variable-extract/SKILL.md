---
name: figma-variable-extract
description: Extract local and enabled-library Variables from a Figma Design file through the official Figma Remote MCP use_figma tool, then generate and validate complete or local-only CSS Design Tokens with this skill's self-contained scripts and default configuration. Use when asked to inventory or export Figma Variables, generate design-tokens.css through temporary src/design-tokens/raw artifacts, resume a failed batch, or diagnose extraction completeness, alias, FLOAT-unit, selector, or CSS-name-collision failures.
---

# Figma Variable Extract

Extract exact MCP results, prove the export is complete, and only then generate CSS. Treat raw JSON as temporary evidence: never edit it to make validation pass, and remove it only after verified CSS generation succeeds.

## Require an explicit generation scope

Require a Figma Design file URL. Ask for it if absent. Parse and retain the fileKey from the URL as run provenance; do not publish a real fileKey in this reusable skill repository.

CSS publication has exactly two scopes:

- **Local-only generation**: inventory the file, export local Variables only, and generate CSS with `--local-only`. Do not export or import Library Variables. Use this mode only when the request explicitly excludes libraries.
- **Complete generation**: export local Variables and every enabled Library Collection, then generate CSS. Library export can import Variables into the target Figma file.

Apply this **hard gate** to every workflow that will validate or generate CSS:

1. Complete the prerequisites, then run only the read-only inventory step.
2. Report the target filename and URL, local Collection and Variable counts, enabled Library Collection and Variable counts, and any inventory errors.
3. Ask the user to choose `local-only` or `complete`. Explain that `local-only` excludes every Library Variable and does not modify Figma through Library import. Explain that `complete` includes every enabled Library Collection and imports every positive-count Library Variable into the target file.
4. Wait for a direct, unambiguous choice. Do not run either export script, validate, generate CSS, delete or replace retained artifacts, or infer a scope while waiting.

There is no default. Even when the initial request appears to name a scope, present the inventory summary and obtain the choice after inventory. Silence, prior runs, existing JSON, configuration, edit access, or an empty Library list do not select a scope. If the response is ambiguous, ask again. When the Library list is empty, explain that the current CSS result should be equivalent but still require the scope choice.

For `complete`, the choice also authorizes the full Library-import mutation only when the choice prompt explicitly stated the target file, Library counts, and mutation. Otherwise, obtain separate explicit confirmation before the first Library export. For `local-only`, never run the Library export script.

The following non-publication modes do not select a CSS scope by themselves:

- **Extraction only**: inventory or export only the explicitly requested scope. Do not claim that CSS is current.
- **Resume**: inspect temporary inventory and batches retained after a failed run, then reacquire only missing or invalid batches. Do not trust filenames alone.

If extraction-only or resume will proceed to CSS validation or generation, pass the hard gate first. Do not offer selected-library CSS generation as complete. `--local-only` deliberately excludes every Library export from validation and CSS, even when recognized Library JSON remains under the temporary input directory.

## Check prerequisites

1. Resolve this skill directory from `SKILL.md`, then require a writable project working directory. The output tree does not need to exist in advance.
2. Check whether `node` is available on `PATH`. If it is unavailable, stop and report that Node.js 22 or later is required. Do not install Node.js or run a remote installation script without user approval.
3. Run `node <skill-directory>/scripts/generate-design-tokens.mjs --check-runtime`. Continue only when it succeeds.
4. When Node.js is older than 22, inspect the target project's existing runtime declarations and installed version managers before remediation. Prefer a compatible runtime already managed by the project. Do not overwrite `.nvmrc`, `.node-version`, `.tool-versions`, `mise.toml`, `package.json`, a global Node.js installation, or equivalent policy without user approval. If a runtime must be installed, recommend a currently supported LTS release and verify the selected manager's current official commands before using them.
5. Read the bundled `scripts/01-inventory.js`, `scripts/02-export-local.js`, `scripts/03-export-library-collection.js`, `scripts/generate-design-tokens.mjs`, and `assets/design-tokens.config.json`. These files are canonical and self-contained.
6. Use the bundled configuration by default. If project-specific semantic rules are required, copy it outside the reusable skill, edit the copy with user approval, and pass its path with `--config`. Do not silently mutate the bundled default.
7. Do not modify a bundled extraction script merely to fit a tool response.
8. Resolve the connected **official Figma Remote MCP** and inspect its current tool schema. Use tool discovery when the Figma tools are not already exposed. Never hardcode a Claude-specific MCP server prefix.
9. Before every `use_figma` call, load the provider's current official `figma-use` skill completely through that provider's supported skill/resource mechanism. Pass any skill identifier required by the discovered `use_figma` schema.
10. If `use_figma` or `figma-use` is unavailable, stop and report the missing connection. Do not fall back to `get_variable_defs`, browser scraping, REST guesses, or fabricated data.
11. Use `get_variable_defs` for none of this workflow. It does not enumerate the file-wide Variable definitions required here.
12. Send bundled script code with top-level `await` and `return`. Do not wrap it in an async IIFE and do not call `figma.closePlugin()`.

Library export calls `importVariableByKeyAsync` and can change the target Figma file. Inventory is read-only, so acquire it first. Before offering complete generation, prefer a duplicate/test file. Require authorization covering both the full scope and this mutation, either through the hard-gate choice described above or through a separate explicit confirmation. Do not treat silence, edit access, or conditional consent such as "if it does not change the file" as authorization. Local-only generation never runs the Library export script and does not require Library-import approval.

## Manage temporary artifacts

Write the complete temporary `raw/` tree directly under the configured `inputDirectory`, which is `src/design-tokens/raw` by default. Do not use an operating-system temporary directory or another staging location:

```text
raw/
├── inventory.json
├── local/batch-<start-index>.json
└── libraries/<library-slug>/<collection-slug>/batch-<start-index>.json  # complete generation only
```

Treat every JSON file under this directory as a temporary artifact for one extraction run. Before starting a fresh run, inspect existing JSON. Resume it only when it belongs to the same target file and requested scope. Otherwise, do not mix it with the new run; obtain approval before removing or replacing retained failed-run evidence.

The generator removes the recognized input JSON and its temporary report JSON only after it writes and re-reads the final CSS successfully. It then removes empty directories from the deepest level through the configured input directory, including `local/`, Library subdirectories, `libraries/`, and `raw/`. It never removes a directory that still contains a non-JSON file or another retained entry. Validation-only, dry-run, and failed generation preserve the JSON and directories so the run can be diagnosed or resumed. Extraction-only mode also preserves its requested artifacts because no CSS generation has completed. In local-only mode, any recognized Library export files left in the input directory are excluded from checksum validation and CSS generation, reported as excluded, and removed with the other temporary JSON only after successful CSS verification.

Save the object returned by `use_figma` without summarizing, omitting fields, changing values, merging records, or hand-editing errors. Parse a copy only for validation. Do not publish a truncated, non-JSON, or tool-error response.

## Run the extraction

### 1. Inventory

Read the bundled `scripts/01-inventory.js`. Replace only the exact `const sourceFileKey = "__FILE_KEY__";` declaration with a declaration containing the JSON-encoded fileKey parsed from the target URL. Execute the resulting code against that URL and save the exact returned object as `src/design-tokens/raw/inventory.json`.

Verify:

- `kind` is `figma-variable-inventory` and `schemaVersion` is `1`.
- `fileKey` matches the target URL.
- `integrity.algorithm` is `fnv1a32-utf16`; the generator will verify its checksum before publication. This checksum detects accidental transcription changes, not malicious tampering.
- local collection and Variable counts are non-negative integers.
- each Library Collection has a unique key.
- every Library Collection has an integer `variableCount` and `error: null`.

Retry only a failed inventory call. If a collection still has an error or null count, preserve the result and mark complete generation as blocked because completeness cannot be proved. Local-only generation remains available when the local inventory is valid because Library counts are outside its publication scope. Include the error in the hard-gate summary, then wait for the user's choice.

If the Library Collection list is empty, report that only libraries enabled in the Figma UI are discoverable and that both scopes should currently produce equivalent CSS. Still require the hard-gate choice before local export. Do not infer missing libraries.

### 2. Local Variables

Run this section only after the user selects `local-only` or `complete` at the hard gate. Both publication scopes require the local export.

Use the requested batch size or `20` by default. Require an integer from 1 through 200. This is a conservative starting point, not a fixed response-size assumption. Run at least one batch, including when inventory reports zero local Variables.

For each call:

1. Read a fresh copy of the bundled `scripts/02-export-local.js`.
2. Replace only the exact `const sourceFileKey = "__FILE_KEY__";` declaration with a declaration containing the JSON-encoded target fileKey.
3. Replace the exact `const startIndex = __START_INDEX__;` and `const batchSize = __BATCH_SIZE__;` declarations with validated decimal integers.
4. Execute the resulting code with `use_figma`.
5. Save the exact result at `src/design-tokens/raw/local/batch-${String(startIndex).padStart(4, "0")}.json`.
6. Continue from `pagination.nextStartIndex` until `hasMore` is `false`.

For every batch, verify:

- schema and source filename match inventory;
- source fileKey matches inventory and the target URL;
- the payload contains its original integrity checksum;
- collection count and Collection Keys match inventory;
- `startIndex`, `batchSize`, and `total` are coherent;
- `returnedDescriptorCount === successCount + errorCount`;
- `nextStartIndex === startIndex + returnedDescriptorCount`;
- each success Variable belongs to its containing collection;
- success and error keys are unique and belong to this batch.

If the provider explicitly truncates a response or the JSON is incomplete, discard it, halve the batch size, and retry the same `startIndex`. If a single-Variable batch is still truncated, stop and report the client/tool limitation. Do not reconstruct or merge MCP responses into a synthetic `local-variables.json`.

### 3. Library Variables

Run this section only after the user selects `complete` at the hard gate and the choice covers the stated mutation. Skip it entirely for `local-only`. Do not call `scripts/03-export-library-collection.js` or `importVariableByKeyAsync` in local-only generation.

For complete generation, process every positive-count Library Collection in inventory. Record zero-count collections as complete without inventing an empty batch; the current validator exempts them from the paginated-batch requirement.

Use the requested batch size or `20` by default. Require an integer from 1 through 200. This is a conservative starting point, not a fixed response-size assumption. For each call:

1. Read a fresh copy of the bundled `scripts/03-export-library-collection.js`.
2. Replace only the exact `const sourceFileKey = "__FILE_KEY__";` declaration with a declaration containing the JSON-encoded target fileKey.
3. Replace the exact `const collectionKey = "__COLLECTION_KEY__";` declaration with a declaration containing the JSON-encoded Collection Key.
4. Replace the exact `const startIndex = __START_INDEX__;` and `const batchSize = __BATCH_SIZE__;` declarations with validated decimal integers.
5. Execute the resulting code with `use_figma`.
6. Save the exact result under `src/design-tokens/raw/libraries/<library-slug>/<collection-slug>/batch-${String(startIndex).padStart(4, "0")}.json`.
7. Continue from the returned `pagination.nextStartIndex`, not from an assumed offset, until `hasMore` is `false`.

Normalize library and collection slugs to lowercase ASCII letters, digits, and hyphens. If empty, use the first 12 characters of the Collection Key. Precompute all destinations; when two paths collide, append the first 12 characters of the Collection Key. Never overwrite one collection with another.

For every batch, verify before continuing:

- source filename, library name, and Collection Key match inventory;
- source fileKey matches inventory and the target URL;
- the payload contains its original integrity checksum;
- `startIndex`, `batchSize`, `total`, and all pagination counts are coherent;
- `returnedDescriptorCount === successCount + errorCount`;
- `nextStartIndex === startIndex + returnedDescriptorCount`;
- success and error keys are unique and belong to this batch.

If the provider explicitly truncates a Library response or the JSON is incomplete, discard it, halve the batch size, and retry the same `startIndex`. If a single-Variable batch is still truncated, stop and report the client/tool limitation. Do not assume a fixed response-size limit. If a complete batch contains import errors, retain it, retry only that batch when useful, and report persistent errors. Do not weaken validation.

## Prove completeness

Before generating CSS from the temporary raw data, always verify:

- local counts match inventory;
- local batches start at `0`, cover contiguous ranges, keep a stable `pagination.total`, and end with `hasMore: false`;
- every included result has the same fileKey as inventory and the target URL;
- every included payload integrity checksum verifies.

For complete generation, additionally verify:

- every positive-count inventory Library Collection has a batch sequence starting at `0`;
- batch ranges are contiguous with no gaps or overlaps;
- `pagination.total` is stable and equals inventory `variableCount`;
- the final batch has `hasMore: false`;
- unique success keys plus unique error keys equal the expected count;
- no Variable Key appears in more than one batch;

Persistent extraction errors or checksum failures within the selected scope make generation incomplete even when the arithmetic matches. Keep successful temporary artifacts at `src/design-tokens/raw` and report their location, but do not generate production CSS.

Never validate or generate CSS before the hard gate has been satisfied. For complete generation, run:

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs --validate-only
```

Require it to succeed. It verifies JSON parsing, payload checksums, fileKey identity, batch continuity, inventory counts, aliases, units, selectors, and CSS-name collisions without writing generated files.

For local-only generation, run:

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs --validate-only --local-only
```

This validates the inventory and local batches only. Library Collections listed in inventory and any Library export JSON present under `raw/` are excluded and reported, not treated as incomplete local input.

Do not move the validated JSON elsewhere. The normal generation command reads it from the same configured input directory. The generator rejects unrecognized JSON in that directory to avoid deleting unrelated files during cleanup.

## Generate and diagnose

After the user selects complete generation, run:

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs
```

Run the command from the target project directory and require it to succeed. The bundled default configuration creates `src/design-tokens/generated/` as needed, writes and verifies `design-tokens.css`, emits the report summary to standard output, then removes all recognized JSON under `src/design-tokens/raw`, the temporary `design-tokens.report.json`, and every directory left empty under `raw/`. Require the CSS to remain, the temporary JSON files to be absent, and `raw/` to be absent when it contains no retained non-JSON entries before reporting completion.

After the user selects local-only generation, run:

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs --local-only
```

Require `completeness.scope` to be `local-only`, `libraryCollectionsChecked` to be `0`, and the excluded Library counts to match inventory. Confirm the generated CSS contains no Library Variables.

When using an approved project-specific configuration, append `--config <config-path>` to the validation and generation commands.

On failure:

- **Invalid WEB codeSyntax**: inspect `INVALID_WEB_CODE_SYNTAX` warnings and `counts.cssNameSources`. The generator falls back to a derived name; do not assume Figma WEB syntax was adopted.
- **Unknown FLOAT unit**: identify the Variable name, scopes, and value. Add an explicit `float.nameRules` or `scopeRules` rule only when the intended unit is established. Never guess `px`.
- **CSS name collision**: report every conflicting Variable and naming source. First inspect Figma `codeSyntax.WEB`; then change the naming policy with user approval. `naming.includeLibraryName: true` may prevent same-name Library collisions but changes the public CSS token names, so never enable it silently. Never delete or edit raw Variables.
- **Unresolved alias**: identify the missing Variable ID/key when evidence permits. Enable and export the referenced Library; never replace the alias with a guessed literal or weaken `aliases.unresolved`.
- **Conflicting declaration**: identify selector, CSS name, modes, and source Variables. Resolve the Figma mode or naming design; do not use last-write-wins behavior.
- **Unknown mode selector**: `unknownModeStrategy: "attribute"` emits `[data-figma-mode="..."]`. Map the mode explicitly, choose `skip`, or choose `error` only with user approval. Do not automatically remove equal values across selectors because CSS cascade and inheritance can make those declarations semantically different.
- **Completeness failure**: reacquire only the implicated inventory, local export, or Library batch. Do not restart a sound extraction.

Treat changes to Figma naming/modes and semantic config rules as product decisions. Present evidence and obtain direction unless the request already specifies the intended mapping.

## Report

Return:

- target Figma filename and URL;
- the generation scope explicitly selected at the hard gate;
- local Collection and Variable counts;
- Library, Collection, success, and failure counts;
- excluded scope, if this was local-only or extraction-only;
- CSS Variable/declaration count, selectors, type counts, aliases, CSS-name source counts, ignored invalid WEB syntax, unresolved aliases, unit warnings/errors, and collisions;
- generated CSS path, retained failed-run artifact paths, successful JSON cleanup, and empty-directory cleanup;
- validation and generator results;
- any Figma mutation, config change, retry, or unresolved blocker.

Say **complete** only when the requested mode's integrity checks pass. For complete generation, require zero extraction errors, verified payload checksums, successful `--validate-only`, verified CSS generation, successful temporary JSON cleanup, and removal of empty temporary directories. For local-only generation, require the equivalent local-scope checks with `--local-only`, explicit Library exclusion in the report, no Library declarations in CSS, successful temporary JSON cleanup, and removal of empty temporary directories.
