---
name: figma-variable-extract
description: Extract Variables actually used by a Figma Design file, including transitive alias dependencies, through the official Figma Remote MCP use_figma tool, then generate and validate usage-scoped CSS Design Tokens with this skill's self-contained scripts and default configuration. Use when asked to inventory or export used Figma Variables, generate design-tokens.css through temporary src/design-tokens/raw artifacts, resume a failed batch, or diagnose usage completeness, alias, FLOAT-unit, selector, or CSS-name-collision failures.
---

# Figma Variable Extract

Extract exact MCP results, prove that every file binding and transitive alias dependency is resolved, and only then generate CSS. Treat raw JSON as temporary evidence. Never edit it to make validation pass, and remove it only after verified CSS generation succeeds.

## Protect confidential provenance

Treat the supplied target URL and fileKey, Figma file and page names, organization and Library names, Collection names, and all Figma file, page, Variable, and Collection IDs or keys as confidential provenance.

Treat the entire response from an identity or connection probe such as `whoami` as confidential. Never repeat its email, handle, user name, account plan, seat or license type, organization membership, or raw response. After a successful probe, report only the language-equivalent of `Official Figma Remote MCP connection verified.` On failure, report only that the connection is unavailable without copying the raw response.

Keep confidential provenance only in exact raw evidence, prepared temporary code, generated project CSS when required by the token contract, and local diagnostics. Never copy it into reusable skill source, commit messages, GitHub Issues or Pull Requests, release notes, publishable reports, external summaries, or normal assistant commentary. Refer to pages and Collections by numeric run index outside local diagnostics.

In user-facing summaries, confirm that the supplied target was used without repeating its URL, fileKey, filename, page names, organization names, Library names, Collection names, IDs, or keys. Report counts, selected scope, phase status, warning codes with counts, artifact status, and sanitized paths instead. If external publication is explicitly requested, sanitize and scan the content first. Local failure diagnostics may retain confidential values needed for repair, but never copy them verbatim into a public artifact or external response.

## Require an explicit generation scope

Require a Figma Design file URL. Ask for it if absent. Parse and retain the fileKey from the URL as confidential run provenance.

CSS publication has exactly two usage scopes:

- **Local-only usage**: export only local Variables found in the file's usage closure and generate CSS with `--local-only`. Exclude every remote Library Variable. This scope can fail when an included local Variable aliases an excluded Library Variable.
- **Complete usage**: export all used Variables plus their transitive alias dependencies, whether local or remote, and generate CSS without `--local-only`.

Enabled Library Collections are diagnostic input, not extraction scope. Never export a Library Variable merely because its Collection is enabled. Neither scope imports Variables or otherwise changes the Figma file. Library export resolves already-used Variables by ID and never calls `importVariableByKeyAsync`.

Apply this **hard gate** to every workflow that will validate or generate CSS:

1. Complete the prerequisites, then run only the read-only inventory step.
2. Confirm that Inventory used the supplied target without repeating its identity. Report direct binding count, alias-dependency count, used local and Library counts, total local definition counts, enabled-but-unused Library Collection count, predicted CSS-name-collision counts for both scopes, warning codes with counts, and inventory error count. Do not report names, IDs, keys, URLs, or warning messages.
3. Ask the user to choose `local-only` or `complete`. Explain that `local-only` excludes remote dependencies and may therefore fail alias validation. Explain that `complete` includes only the complete usage closure and does not import enabled-but-unused Library Variables.
4. Wait for a direct, unambiguous choice. Do not run either export script, validate, generate CSS, delete or replace retained artifacts, or infer a scope while waiting.

There is no default. Even when the initial request appears to name a scope, present the inventory summary and obtain the choice after inventory. Silence, prior runs, existing JSON, configuration, edit access, an empty Library list, or a previous scope choice for another file do not select a scope. If the response is ambiguous, ask again.

The following non-publication modes do not select a CSS scope by themselves:

- **Extraction only**: inventory or export only the explicitly requested usage scope. Do not claim that CSS is current.
- **Resume**: inspect retained inventory and batches after a failed run, then reacquire only missing or invalid batches. Do not trust filenames alone.

If extraction-only or resume will proceed to CSS validation or generation, pass the hard gate first. Do not describe all enabled definitions or a selected subset as complete usage.

## Check prerequisites

1. Resolve this skill directory from `SKILL.md`, then require a writable project working directory. The output tree does not need to exist in advance.
2. Check whether `node` is available on `PATH`. If unavailable, stop and report that Node.js 22 or later is required. Do not install Node.js or run a remote installation script without user approval.
3. Run `node <skill-directory>/scripts/generate-design-tokens.mjs --check-runtime`. Continue only when it succeeds.
4. When Node.js is older than 22, inspect the target project's runtime declarations and installed version managers before remediation. Prefer a compatible runtime already managed by the project. Do not overwrite runtime policy or install software without user approval.
5. Run `node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase self-check`. It validates the canonical extraction snippets, their exact placeholders, the bundled configuration, and the read-only API contract. Do not load bundled script source into model context during a healthy run. Read only the file named by a self-check, preparation, validation, or generation error.
6. Use the bundled configuration by default. If project-specific semantic rules are required, copy it outside the reusable skill, edit the copy with user approval, and pass its path with `--config`. Do not silently mutate the bundled default.
7. Do not modify a bundled extraction script merely to fit a tool response.
8. Resolve the connected **official Figma Remote MCP** and inspect its current tool schema. Use tool discovery when the Figma tools are not already exposed. Never hardcode a client-specific MCP server prefix. Apply the confidential identity-probe rule to every connection check and its commentary.
9. Before the first `use_figma` call, load the provider's current official `figma-use` skill completely through that provider's supported skill or resource mechanism. Reload it only when the connection or schema changes. Pass any skill identifier required by the discovered `use_figma` schema on every call.
10. If `use_figma` or `figma-use` is unavailable, stop and report the missing connection. Do not fall back to `get_variable_defs`, browser scraping, REST guesses, or fabricated data.
11. Do not use `get_variable_defs` for this workflow. It does not provide the raw, checksummed, paginated usage contract required here.
12. Send bundled script code with top-level `await` and `return`. Do not wrap it in an async IIFE and do not call `figma.closePlugin()`.

All bundled extraction scripts are read-only. Never call `loadAllPagesAsync`; the official Remote MCP runtime does not expose it. List the file's pages first, then scan one page per `use_figma` call. The page scanner calls `setCurrentPageAsync` at most once per `use_figma` call, safely probes node properties that may throw for unsupported node types, resolves styles referenced by that page's nodes with `getStyleByIdAsync`, and inspects those styles' bindings. Later scripts resolve Variables with `getVariableByIdAsync`, resolve Collections with `getVariableCollectionByIdAsync`, and follow `VARIABLE_ALIAS` values transitively. They do not bind Variables, import Variables, or edit nodes.

## Manage temporary artifacts

Write the complete temporary `raw/` tree directly under the configured `inputDirectory`, which is `src/design-tokens/raw` by default:

```text
raw/
├── page-list.json
├── pages/page-<zero-padded-index>.json
├── inventory.json
├── plans/batch-<start-index>.json  # complete usage or local fallback only
├── local/batch-<start-index>.json
└── libraries/collection-<zero-padded-index>/batch-<start-index>.json  # complete usage only
```

Treat every JSON file under this directory as a temporary artifact for one extraction run. Before starting a fresh run, inspect existing JSON. Resume it only when it belongs to the same target file, usage checksum, and selected scope. Otherwise, do not mix it with the new run. Obtain approval before removing or replacing retained failed-run evidence.

Run page listing, every page scan, inventory, and exports against one stable Figma revision. If a page identity changes, a page disappears, the direct-ID manifest drifts, or an export usage checksum differs from inventory, preserve the evidence and restart from page listing. The runtime does not expose a revision lock, so report concurrent-edit risk when the file may be changing during a long fan-out.

The generator removes recognized input JSON and its temporary report JSON only after it writes and re-reads the final CSS successfully. It then removes empty directories through the configured input directory. It never removes a directory containing a non-JSON file or another retained entry. Validation-only, dry-run, and failed generation preserve JSON and directories for diagnosis or resume.

Save the object returned by `use_figma` without summarizing, omitting fields, changing values, merging records, or hand-editing errors. Parse a copy only for validation. Do not publish a truncated, non-JSON, or tool-error response.
Do not use `figma.clientStorage`, cross-call chunk reconstruction, or another stateful workaround to bypass the response limit.

Create one temporary prepared-code directory outside the target project with `mktemp -d`. Use `scripts/prepare-use-figma-code.mjs` for every placeholder substitution. Never hand-build or patch injected MCP code. The preparer validates saved checksums and prints only non-sensitive execution metadata, including the exact absolute `artifactPath` for each MCP result; its generated code contains provenance and must remain outside the project. Save only to that returned `artifactPath`. Never construct, shorten, or replace it with a relative path. Remove the prepared-code directory after success.

After each `use_figma` result, save the exact result immediately before commentary, checksum investigation, or the next call. Keep one workflow checklist instead of creating a task item for every page or batch. Record the workflow start, each phase boundary, scope-wait duration, `use_figma` call count, retries, and finish time.

## Run the extraction

### 1. List pages

Prepare the canonical page-list code instead of editing it:

```bash
node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase page-list --file-key "<fileKey>" --output "<prepared-code-directory>/page-list.js"
```

Read that prepared code once, execute it against the target URL, and save the exact returned object immediately to the exact absolute `artifactPath` reported by the preparer.

Verify its payload checksum, fileKey, filename, page count, page order, unique page IDs, and unique indices. If the result is truncated or inconsistent, preserve it and stop. Do not guess omitted pages.

### 2. Scan every page

Prepare up to five page calls at once:

```bash
node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase page-wave --raw-dir src/design-tokens/raw --start-index <page-index> --count <1-to-5> --output-dir "<prepared-code-directory>/pages"
```

Read the returned prepared files, execute one page per `use_figma` call, and save each exact result immediately to that page entry's exact absolute `artifactPath`.

The assistant message immediately after reading a prepared wave must contain exactly the reported number of `use_figma` tool calls and no commentary or unrelated tool call. Emit all calls before waiting for any result so the client can run them concurrently. Start with no more than five calls, reduce concurrency after timeouts or rate-limit responses, and retry only the failed page. If the first result arrives before the client accepts the remaining calls, record the wave as client-serialized. Never combine two pages in one call. The scanner must call `setCurrentPageAsync` exactly once for its target page and never call `loadAllPagesAsync`.

Verify each payload checksum, fileKey, filename, page identity, counts, sorted unique direct Variable IDs, sorted unique explicit-mode Collection IDs, and empty `errors`. Treat a property-read failure already caught by the scanner as absent data. Any reported style-resolution error or other scan error makes coverage incomplete; preserve all page evidence and stop.

After every page succeeds, let the preparer derive these compact values without modifying the saved raw JSON:

- `pageManifest`: one ordered entry per page containing `index`, `id`, `name`, `scanChecksum`, and the exact `counts` object;
- `directVariableIds`: the sorted unique union of every page's `directVariableIds`;
- `explicitVariableModeCollectionIds`: the sorted unique union of every page's corresponding list.

The preparer verifies every raw checksum before deriving these values. If the prepared inventory code exceeds the provider's current code-size limit, stop and report the limitation instead of truncating evidence or IDs.

### 3. Inventory file usage

Prepare the Inventory code from saved page evidence:

```bash
node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase inventory --raw-dir src/design-tokens/raw --output "<prepared-code-directory>/inventory.js"
```

Read that prepared code once, execute it against the same target URL, and save the exact returned object immediately to the exact absolute `artifactPath` reported by the preparer. The preparer injects the validated page manifest, direct IDs, explicit-mode Collections, unchanged naming configuration, and `maxInventoryPayloadBytes`.

The inventory proves page coverage from the injected manifest, resolves the injected direct IDs, and follows every `VARIABLE_ALIAS` in `valuesByMode` until the reference graph closes. Do not inject enabled Library definitions or any manually selected subset.

Verify:

- `kind` is `figma-variable-inventory` and `schemaVersion` is `2`;
- `fileKey` matches the target URL;
- `integrity.algorithm` is `fnv1a32-utf16`;
- `usage.pageCount`, `usage.scannedPageCount`, `usage.pageListChecksum`, and `usage.pageScansChecksum` exactly describe the saved page evidence;
- `usage.directVariableCount` and `usage.directVariableIdsChecksum` exactly match the derived union without duplicating that full ID list in Inventory;
- `usage.errors` is empty, direct and resolved counts are coherent, and the usage checksum is present;
- `local.variableCount` counts used local Variables while `local.definedVariableCount` reports all unique local definitions;
- `local.variableIdsChecksum` and every `libraryCollections[].variableIdsChecksum` commit to their Export plans;
- `local.variableIds`, when present, is the complete ordered local plan, matches its count and checksum, and enables the local-only fast path; its absence means the plan did not fit the Inventory payload limit and requires the fallback Export-plan phase;
- `libraryCollections` contains only used remote Collections and their alias dependencies;
- `enabledLibraryCollections` is diagnostic only and identifies enabled-but-unused Collections;
- `namingPreflight.localOnly` and `namingPreflight.complete` use the selected naming configuration and report exact CSS-name collisions rather than same-name Collection heuristics;
- each used Collection has a unique key, non-negative integer count, and usage checksum.

Require the serialized Inventory to fit `maxInventoryPayloadBytes`. Treat `GENERIC_FILE_NAME`, `NO_LOCAL_VARIABLE_DEFINITIONS`, `NO_VARIABLE_BINDINGS`, `ENABLED_LIBRARY_UNUSED`, `USED_LIBRARY_NOT_ENABLED`, and `CSS_NAME_COLLISION_PREDICTED` as explicit warnings in the hard-gate summary. Do not turn enabled-but-unused Collections into export work. Do not choose a scope automatically to avoid a predicted collision. If `usage.errors` is non-empty, preserve the inventory and stop because the usage closure cannot be proved. Now apply the hard gate and wait for the user's scope choice.

### 4. Finalize the size-bounded Export plan when required

For `complete`, always prepare the size-bounded Export plan. For `local-only`, skip this phase when `inventory.local.variableIds` is present and valid. If it is absent, use the same phase with `--scope local-only` as the size-safe fallback.

Prepare each required Export-plan page:

```bash
node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase plan --raw-dir src/design-tokens/raw --scope <local-only-or-complete> --start-index <index> --output "<prepared-code-directory>/plan-<index>.js"
```

Start at index `0`, read the prepared code once, execute it, save the exact response immediately to the exact absolute `artifactPath` reported by the preparer, and continue from `pagination.nextStartIndex` until `hasMore` is `false`. The preparer injects the validated direct-ID union, compact Inventory summaries, selected scope, `maxBatchSize`, and `maxPlanPayloadBytes`.

The plan call re-resolves the complete alias closure and requires every Inventory count, identity checksum, and Collection checksum to remain stable. It returns only local IDs for the local fallback, or the complete usage closure grouped into local and used-Library ranges for `complete`. Each response is independently size-bounded. Never combine chunks from different manifests. Verify contiguous pagination, identical source and group manifests, batch checksums, the full plan checksum, unique IDs, and exact agreement with Inventory. If the closure changed, discard the plan and restart at Inventory.

### 5. Export used local Variables

Run this section only after the user selects `local-only` or `complete`. Both scopes require the local export.

Use `config.extraction.maxBatchSize` and `config.extraction.maxPayloadBytes`. Run at least one batch, including when Inventory reports zero used local Variables. The preparer reads the embedded Inventory plan first and otherwise requires the verified fallback Export plan. Every local batch fetches only its planned IDs and does not recompute the closure.

For each call:

1. Run `node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase local --raw-dir src/design-tokens/raw --start-index <index> --output "<prepared-code-directory>/local-<index>.js"`. Require its safe metadata to report `planSource: "inventory"` for the fast path or `planSource: "export-plan"` for the fallback.
2. Read the prepared code once and execute it with `use_figma`.
3. Save the exact result immediately to the exact absolute `artifactPath` reported by the preparer.
4. Continue from `pagination.nextStartIndex` until `hasMore` is `false`.

The preparer always selects `inventory.local.usageChecksum` for local Export. Do not substitute the complete-usage checksum or create a scratch code generator.

Verify the schema, fileKey, filename, payload checksum, Export-plan checksum, usage checksum, batch identity checksum, Collection identities, pagination arithmetic, configured extraction limits, success and error counts, and Variable ownership for every batch. Require the verified Export plan to match Inventory before accepting any local batch.

The script measures UTF-8 bytes and stops adding Variables before the serialized result exceeds `maxPayloadBytes`, then returns the next exact index. If one Variable cannot fit by itself, preserve prior evidence, stop, and report the tool limitation. If the provider still truncates a response or returns incomplete JSON, discard it and retry the same `startIndex` with a smaller approved limit. Do not reconstruct multiple MCP responses into synthetic JSON.

### 6. Export used Library Variables

Run this section only after the user selects `complete`. Skip it entirely for `local-only`.

Process every positive-count entry in `inventory.libraryCollections`. The script reads only the current Batch slice from that Collection's checksummed Export-plan IDs. It does not recompute the usage closure, rescan pages, enumerate the rest of the enabled Collection, or import any Variable.

For each call:

1. Run `node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase library --raw-dir src/design-tokens/raw --collection-index <inventory-index> --start-index <index> --output "<prepared-code-directory>/library-<collection-index>-<index>.js"`.
2. Read the prepared code once and execute it with `use_figma`.
3. Save the exact result immediately to the exact absolute `artifactPath` reported by the preparer.
4. Continue from `pagination.nextStartIndex` until `hasMore` is `false`.

The preparer uses the Inventory Collection index in the artifact path, so confidential names and keys never enter filenames. Never rename that path or overwrite one Collection with another.

Verify the source filename, optional Library name, Collection key, fileKey, payload checksum, Export-plan checksum, usage checksum, batch identity checksum, pagination arithmetic, configured extraction limits, and unique success and error keys. The source usage checksum must equal the Collection's `inventory.libraryCollections[].usageChecksum`. Use the same size-bounded behavior as the local Export. Preserve persistent extraction errors and do not weaken validation.

## Prove reference completeness

Before generating CSS, verify:

- page-list, every page scan, inventory, and every included batch have valid payload checksums and one fileKey;
- page IDs in the scans exactly cover the ordered page list, with no missing, duplicate, substituted, or error-bearing page;
- the raw page-scan direct-ID union and aggregate counts exactly match the inventory usage manifest;
- local and Library usage checksums still match inventory;
- complete usage and local fallback have a size-bounded Export plan that re-proves Inventory after scope selection; the local-only fast path instead verifies the embedded Inventory plan's exact count and checksum;
- every export's direct-ID, Export-plan, and batch-identity checksums match the verified plan, Inventory, and its own payload;
- each batch sequence starts at `0`, covers contiguous ranges without gaps or overlaps, keeps a stable total, and ends with `hasMore: false`;
- unique success keys plus unique error keys equal each inventory count;
- exported Variable IDs exactly match the selected Inventory Export plans;
- complete usage recomputes the Alias closure from exported values and requires exact agreement with inventory;
- every alias ID referenced by a local-only Variable resolves to another exported local Variable.

Persistent extraction errors, unresolved usage IDs, usage-checksum drift, unresolved aliases, or payload-checksum failures make generation incomplete even when counts match. Preserve successful artifacts and report their paths. Do not generate production CSS.

For complete usage, run:

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs --validate-only
```

For local-only usage, run:

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs --validate-only --local-only
```

Require validation to succeed. Local-only validation excludes Library artifacts but still rejects an included local Variable whose alias target was excluded.

## Generate and diagnose

After complete-usage validation, run:

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs
```

After local-only validation, run:

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs --local-only
```

Run from the target project directory and require success. When using an approved project-specific configuration, append `--config <config-path>` to validation and generation. Confirm that CSS remains, recognized temporary JSON is removed, and the raw directory is removed when empty.

On failure:

- **Usage checksum drift**: restart at inventory against one stable Figma revision.
- **Invalid WEB codeSyntax**: inspect `INVALID_WEB_CODE_SYNTAX` warnings and naming-source counts. Do not assume the invalid syntax was adopted.
- **Unknown FLOAT unit**: establish the intended unit before adding a name or scope rule. Never guess `px`.
- **CSS name collision**: inspect every conflicting Variable and naming source locally, then report the warning code and count. Change naming policy only with user approval.
- **Single Variable exceeds the payload limit**: retain its ID in local diagnostics and report the error category and configured limit. Do not omit fields, split one Variable across responses, or hand-build its JSON.
- **Unresolved alias**: identify the missing ID locally and use complete usage when local-only excluded a remote dependency. Report only the error category and count externally. Never replace the alias with a guessed literal or weaken validation.
- **Conflicting declaration**: inspect selector, CSS name, modes, and source Variables locally. Report only the conflict category and count externally. Resolve the Figma mode or naming design instead of applying last-write-wins behavior.
- **Unknown mode selector**: map the mode explicitly or obtain approval for `skip` or `error`. Do not remove equal declarations across selectors automatically.
- **Completeness failure**: reacquire only the implicated inventory or batch unless the usage checksum changed.

Treat Figma naming, modes, and semantic configuration as product decisions. Present evidence and obtain direction unless the request already specifies the mapping.

## Report

Return:

- confirmation that the supplied target was used, without repeating confidential provenance;
- the scope selected at the hard gate;
- listed page count, verified page-scan count, page-scan retries, and any concurrent-edit risk;
- direct binding, alias-dependency, used local, used Library, total local-definition, enabled-Library, and enabled-but-unused counts;
- CSS Variable and declaration counts, selectors, types, aliases, CSS-name-source counts, warning codes with counts, unresolved-alias count, unit-error count, and collision count;
- generated CSS path, retained failed-run artifacts, successful JSON cleanup, and empty-directory cleanup;
- validation and generator results;
- Export-plan source (`inventory` fast path or `mcp`), elapsed time by prerequisites, page scan, Inventory, scope wait, Export plan, Variable Export, and generation, plus `use_figma` call count and avoidable retries;
- confirmation that no Figma mutation occurred, plus retries, configuration changes, or unresolved blockers.

Do not include Figma URLs, fileKeys, filenames, page names, organization names, Library names, Collection names, IDs, keys, raw warning messages, or verbatim local failure diagnostics in this report.

Say **complete** only when the selected usage scope passes integrity checks, usage-set checks, reference resolution, validation, CSS write verification, temporary JSON cleanup, and empty-directory cleanup.
