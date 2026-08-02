# Figma-to-Code Mapping Contract

Persist one project-owned JSON map so later runs update mapped code instead of regenerating the UI. The bundled template and validator define the schema.

## 1. Ownership and version

Use the project's convention, otherwise `.figma/figma-code-map.json`. Store repository-relative paths and stable Figma IDs. Never store tokens, authorization headers, private identities, full Figma responses, temporary URLs, screenshots, or capture paths.

Use only `schemaVersion: 1`. This is the first release contract; there is no legacy mode. Unknown fields and every other version fail validation.

Require these top-level fields:

- `source`: Figma URL, revision, exact URL-selected node IDs, and implementation root IDs;
- `target`: stack, supported widths, sourced breakpoints, required states, and scenarios;
- `acquisition`: the acquisition capability ledger;
- `decisions`: shared evidence-backed decisions;
- `mappings`: one code mapping per selected root;
- `assets`: local exported assets, or an empty array;
- `gaps`: unresolved gaps, empty only at completion;
- `verification`: one current implementation digest plus repository, visual, and responsive results.

Use these acquisition keys:

```text
metadata, designContext, screenshot, variables, codeConnect,
libraries, assets, motion, shaders, restGapFill
```

`metadata`, `designContext`, `screenshot`, `variables`, and `codeConnect` must be `acquired`, including an acquired empty result. Conditional capabilities may be `not-applicable` with a concrete reason. Blocked, unauthorized, inconsistent, or truncated evidence is a gap.

Keep `source.selectionNodeIds` exactly as selected by the user, including the URL `node-id`; use `rootNodeIds` for roots actually mapped after deliberate decomposition. Prefer Figma version or last-modified metadata for `source.revision`. If unavailable, use `evidence-sha256` only with `--print-source-digest`, which hashes the selected IDs, scenarios, Figma evidence sources, assets, and source image records. A single screenshot hash is not a source revision.

## 2. Code targets and implementation decision

Give each code target a stable `id`, repository-relative `path`, exact locator, and a symbol when the language adapter supports symbols. Normalize paths before identity checks. A JS/TS target identity is normalized path plus symbol; otherwise it is normalized path plus locator. Different IDs, `src/x` versus `src/./x`, or different locators cannot alias the same symbol.

For JS/TS, require a symbol and verify its declaration from executable source. Locator checks provide synchronization anchors, not semantic proof. Comments and string literals cannot satisfy declarations, component imports, or JSX usage. For another language, add a deterministic semantic adapter before completion.

Each root mapping requires:

- `implementation.approvalRef`: explicit approval of the complete proposal as a `user-decision`;
- `boundary.kind`: `page`, `layout`, `component`, or `section`;
- `boundary.outputCode`: the code target implementing the root;
- `boundary.basisRef`: Figma structure, Code Connect, project, platform, or user evidence;
- `placement.reuseScope`: `route`, `page`, `feature`, `shared`, `app-shell`, or `standalone`;
- `placement.hostCode`: a canonical code target distinct from the output, except for standalone;
- `placement.basisRef`: a project, platform, or user decision.

Figma may establish the boundary but not application placement. Standalone output requires an explicit user decision. Create or update the map with the approved proposal before the first implementation write.

## 3. Evidence and decisions

Each evidence record contains a category, origin, exact source node and property, target code and property, and `status` of `exact` or `transformed`. A transformed record requires a shared `basisRef`; exact evidence omits it. Keep typed values instead of prose.

Cover every category listed in `figma-evidence.md` with evidence or a concrete `notApplicable` reason, never both. `identity-hierarchy` and `geometry` always require evidence. Coverage is derived and is not duplicated in another array.

Use decision kinds:

- `figma-structure`;
- `figma-code-connect`;
- `project-rule`;
- `platform-contract`;
- `user-decision`;
- `approved-deviation`.

When exact sources conflict, keep the primary source plus typed `source.alternatives`. Mark the result `transformed` and resolve it only with a `project-rule`, `user-decision`, or `approved-deviation`. A Figma-structure decision or rendered appearance cannot silently select one side. Leave a gap when no precedence exists.

## 4. Components, assets, and interactions

Recursively inventory every selected or descendant Component, Component Set, and Instance. Use the exact component key, or `node:<node-id>` only when no key exists. Never create a readable synthetic key.

Each `componentBindings` entry records:

- all matching node IDs;
- `reuse-existing` or `create-component`;
- one component code target and real import specifier;
- every consumer code target plus import and JSX usage locators;
- matching `component-properties` evidence;
- a reuse or creation decision.

Use one canonical action, normalized code identity, and import specifier per component key across the entire map. Bind a Component Set to one typed component API. Never inline a Figma component. The JS/TS adapter verifies the declared component, executable import, and executable JSX use, so commented examples cannot pass.

When one component key has multiple ordered instances, add one exact `identity-hierarchy` record whose source property is `instanceOrder`, source reference is the component key, and value is the ordered stable labels. Map the same array to target property `literal-order`. The JS/TS adapter verifies those literals in executable source order.

Each asset record has a stable ID, Figma node ID or image reference, local path, SHA-256, and `rootNodeIds` for affected selected roots. This top-level array is the single asset record; do not duplicate assets as mapping evidence. The validator derives asset coverage from `rootNodeIds` and rehashes the local file.

Interactive elements require `interaction-motion` evidence. Map destinations, events, states, and motion from Figma prototypes, repository contracts, or user decisions. Do not mark interaction not applicable merely because Figma lacks a prototype. The JS/TS adapter checks static `href` and `to` values in JSX and data objects. Empty links, `#`, and unmatched fragments such as `#features` fail even when routed through a variable.

## 5. States and responsive scenarios

Record every required root state in `target.requiredStates` with its basis. Every required state must occur in at least one scenario. This avoids a full state-by-width Cartesian product while preventing default-only completion when hover, loading, error, or another state is in scope.

Record supported minimum and maximum widths and exact breakpoints with project, platform, or user decision references. For each root, require scenarios at minimum, maximum, one pixel below each in-range breakpoint, and the breakpoint itself. Endpoint Figma frames do not prove the transition width.

Each scenario binds one root, viewport, state, and evidence:

- `figma-node`: that exact node, state, and viewport exists;
- `project-rule`: verified repository behavior;
- `user-decision`: explicit behavior approved by the user.

Add additional state-width scenarios only when behavior changes.

## 6. Compact verification

Store shared verification identity once:

```json
{
  "implementation": {
    "algorithm": "figma-codegen-files-sha256@1",
    "digest": "<sha256>",
    "verifiedAt": "<ISO timestamp>",
    "additionalPaths": []
  }
}
```

The digest is recomputed from every unique normalized `mappings[].code[].path`, `assets[].path`, and `verification.implementation.additionalPaths`, sorted by path, including path, byte length, and bytes. Add package manifests, lockfiles, font declarations, and build or styling configuration when they affect rendering but are not code targets. It binds repository checks, responsive measurements, and visual comparisons to the same current implementation. Do not repeat revision or timestamps in each result.

Generate it from the target repository:

```bash
node <skill-directory>/scripts/validate-figma-code-map.mjs --print-digest <map-path>
```

Each repository check stores only its exact command and `pass` result. Actually run it in the current session; the map cannot prove command execution independently.

Each responsive check stores its scenario, actual viewport and device pixel ratio, document widths, root bounds, and typed assertions. Expected and actual must match. At least one assertion must measure rendered layout or content behavior such as direction, visibility, wrapping, or ordered content; viewport and overflow values alone are insufficient. The validator rejects overflow, viewport mismatch, out-of-document roots, and Figma-backed root dimensions that differ by more than 0.5 pixels.

Each Figma-backed scenario additionally stores one visual comparison:

- source and implementation dimensions and SHA-256 hashes;
- implementation root bounds;
- actual viewport and device pixel ratio;
- numeric `pixelDiffRatio` and `normalizedRmse`.

The comparator and validator fix maximums at `0.03` and `0.08`; the map does not repeat configurable thresholds or a self-authored pass result. Images must represent the exact Figma node and root-only implementation at identical dimensions. Keep them temporary.

## 7. Synchronization and completion

For resync, validate the map, reacquire the same roots and categories, compare stable Figma and code identities, classify Figma-only, code-only, concurrent, or approved-deviation changes, and edit only compatible mapped targets. Refresh the shared digest and all affected verification after any code or asset change.

Run the completion gate from the target repository:

```bash
node <skill-directory>/scripts/validate-figma-code-map.mjs <map-path>
```

The gate rejects unknown schema, missing approval or acquisition, self-host aliases, stale executable symbols/imports/usages, inconsistent component bindings, mismatched assets, missing states or scenarios, interactions without evidence, invented fragments, source conflicts without valid precedence, stale implementation digests, overflow, geometry or viewport mismatch, weakened visual fidelity, and unresolved gaps.

Passing validation confirms current referenced files and internal records. It does not independently prove that a human or agent truly executed each external browser or repository command. Run those checks freshly and report that trust boundary honestly.
