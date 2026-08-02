---
name: figma-codegen
description: Generate or update project-native application UI from Figma Design URLs with evidence-backed fidelity, responsive behavior, reusable components, and a persistent Figma-to-code map. Use when asked to implement Figma frames, screens, components, variants, assets, UI-bound tokens, responsive layouts, interactions, motion, or shaders; compare code with Figma; or resync code after a Figma change. Do not use for standalone Figma Variable inventory or export; use figma-variable-extract instead. Use official Figma MCP evidence first, read-only official REST gap-fill only when necessary, and fail closed instead of guessing design or behavior values.
---

# Implement a Figma Design

Treat Figma as the visual source, the repository as the implementation source, and the project-owned map as the synchronization source. Keep the workflow short; put detailed evidence and validation records in the bundled resources, not in prose.

## Check prerequisites

1. Resolve this skill directory and the writable target repository.
2. Require `node` on `PATH`; do not install or replace a runtime without approval.
3. Run `node <skill-directory>/scripts/validate-figma-code-map.mjs --check-runtime` and continue only with Node.js 22 or later.
4. Read repository instructions and inspect the actual stack, routing, component ownership, styling, tokens, assets, tests, and runtime declarations before writing.

## Follow the workflow

### 1. Resolve and approve the implementation contract

Use read-only inspection to resolve:

- exact URL-selected Figma node IDs, implementation root IDs, and names;
- boundary kind: page, layout, component, or section;
- output path and symbol;
- host path and symbol, or explicit standalone output;
- reuse scope and state or data owner;
- required states, supported width range, exact viewports, and breakpoint sources;
- every descendant Figma Component, Component Set, and Instance as `reuse-existing` or `create-component`.

Decide from explicit user scope, verified repository rules, verified Code Connect or existing-code contracts, then Figma structure for the boundary only. A Figma URL, layer name, common convention, or single plausible repository target is not approval. Figma structure never proves placement or reuse scope.

Present one concise proposal covering every item above and ask for explicit approval before the first code, asset, dependency, or configuration write. Ask a targeted question first when evidence leaves alternatives. Record approval as a `user-decision`; silence and unrelated prior approval do not count.

### 2. Acquire scoped evidence

Read [figma-evidence.md](references/figma-evidence.md) completely. Discover and use the connected official Figma MCP's current read tools for metadata, design context, exact-node screenshots, Variables and Styles, Code Connect, assets, annotations, motion, shaders, and library references. Split large roots into stable children and prove coverage; a successful call is not proof of an untruncated result.

Use current official REST documentation and least-privileged read-only endpoints only for identified MCP gaps. Never persist a token or perform Figma or Code Connect mutations. Use Variables only as evidence for this UI; route standalone inventory or export to `figma-variable-extract`.

Preserve exact IDs, values, units, bindings, aliases, modes, component keys, properties, assets, and sources. Never synthesize a component key; use the exact key or `node:<node-id>` fallback. When sources conflict, store the alternatives and resolve only through a project rule, explicit user decision, or approved deviation. Otherwise record a gap and stop that property.

### 3. Create or load the map

Read [mapping-contract.md](references/mapping-contract.md) completely. Copy [figma-code-map.template.json](assets/figma-code-map.template.json) to the approved project location, defaulting to `.figma/figma-code-map.json`, or validate and load the existing map for a resync.

Before implementation starts, record the approved contract, planned code targets, acquired evidence, component inventory, required states, scenarios, and concrete gaps. The in-progress map may fail completion validation; it must not claim guessed values.

Map every coverage category or a concrete not-applicable reason. Bind every descendant Figma component to one imported project component and keep one canonical binding per component key across all roots. The bundled semantic adapter verifies JS/TS declarations, imports, and JSX uses as executable code rather than comments. For another language, add a deterministic repository-native adapter before claiming completion; never downgrade to string-only proof.

For repeated instances of one component key, record one ordered `identity-hierarchy` evidence array and map it to executable literal order. Keep assets only in the canonical top-level `assets` array with their affected root IDs; do not duplicate asset evidence records.

### 4. Implement from evidence

Follow the repository's architecture and reuse verified components, tokens, assets, utilities, and tests. Keep Component Sets as one typed API with variants. Do not inline Figma components, recreate a compatible existing component, install an unnecessary library, or introduce a second styling system.

Do not invent routes, fragment links, event handlers, labels, motion, or data. Resolve interactive behavior from Figma prototypes, repository contracts, or user decisions; otherwise expose a project-native required input or stop and ask. Placeholder destinations such as unmatched `#features` are forbidden, including values stored in JS/TS data objects and later passed through JSX.

Export real assets through Figma evidence. Do not redraw icons, substitute images, or embed expiring URLs. Preserve outer positioning or clipping boxes around `img`, `video`, `svg`, and `canvas` leaves until measured bounds prove flattening equivalent.

### 5. Implement responsive behavior

Use exact multiple Figma viewports, verified project responsive rules, or explicit user decisions. Endpoint frames do not prove a breakpoint. Never select a midpoint, common device width, or inferred rearrangement.

Inventory required states per root. Add scenarios for every state and, for each root, the supported minimum, maximum, one pixel below each in-range sourced breakpoint, and the breakpoint itself. Add more state-width combinations when behavior differs; do not create an unnecessary Cartesian product.

### 6. Verify and complete

Run repository formatting, static analysis, tests, build, and relevant interaction checks. For every scenario, measure the actual browser viewport, device pixel ratio, document widths, root bounds, and typed expected-versus-actual assertions. Include at least one rendered layout or content behavior assertion, not only viewport or overflow measurements. Fail on overflow, viewport mismatch, missing state, or out-of-bounds roots.

For each Figma-backed scenario, compare a fresh exact-node Figma image with a root-only implementation image of identical dimensions:

```bash
node <skill-directory>/scripts/compare-images.mjs \
  --source <temporary-figma-node.png> \
  --implementation <temporary-implementation.png>
```

Keep only dimensions, hashes, root bounds, viewport measurements, and metric values in the map. Screenshots are disposable. Do not crop, resize, weaken the fixed thresholds, or convert visual judgment into a pass.

Bind all verification to the current mapped code and assets:

```bash
node <skill-directory>/scripts/validate-figma-code-map.mjs --print-digest .figma/figma-code-map.json
node <skill-directory>/scripts/validate-figma-code-map.mjs .figma/figma-code-map.json
```

Store the printed digest and current verification time, then run the validator. Rerun measurements, comparisons, repository checks, and the digest after any implementation change or handoff. Do not claim completion while a gap or check remains.

When `source.revision.type` is `evidence-sha256`, generate it with `--print-source-digest`; never reuse a screenshot hash. Add package manifests, lockfiles, or render-affecting configuration to `verification.implementation.additionalPaths` before printing the implementation digest.

### 7. Resync after a Figma change

Validate the current map, reacquire the same roots and categories, and compare by node ID, component key, property, Variable or Style ID, asset reference, and canonical code target. Classify drift as Figma-only, code-only, concurrent, or approved deviation. Update only compatible affected paths, preserve unrelated changes, refresh the shared digest and verification, and stop for conflicting intent.

## Enforce no guessing

Emit a value or behavior only from an exact Figma property, Variable, Style, asset, annotation, or prototype; verified Code Connect; a target-repository or platform contract; or an explicit user decision. A screenshot validates rendering but is not a numeric style source. Generated sample code is evidence to inspect, not code to paste.

## Report

Report the implemented roots and code targets, placement, reused or created component bindings, states and widths, evidence sources and REST gap-fill, map path, repository checks, visual metrics, responsive measurements, transformations, deviations, and remaining gaps. State whether the scope is complete, partial, or blocked. Do not expose tokens or private payloads.

## Bundled resources

- [figma-evidence.md](references/figma-evidence.md): evidence coverage, conflict handling, and REST boundary.
- [mapping-contract.md](references/mapping-contract.md): schema, component bindings, shared digest, and completion gate.
- [figma-code-map.template.json](assets/figma-code-map.template.json): minimal schema version 1 starter.
- `scripts/validate-figma-code-map.mjs`: runtime, schema, semantic, asset, scenario, and digest gate.
- `scripts/compare-images.mjs`: deterministic fixed-threshold PNG comparator.
