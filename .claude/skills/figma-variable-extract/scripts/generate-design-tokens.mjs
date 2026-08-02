import { mkdir, readFile, readdir, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
const minimumNodeMajor = 22;
const args = process.argv.slice(2);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultConfigPath = path.resolve(scriptDirectory, "../assets/design-tokens.config.json");
function parseArguments(values) {
    const parsed = {
        config: null,
        input: null,
        dryRun: false,
        validateOnly: false,
        runtimeCheckOnly: false,
        localOnly: false,
    };
    const valueOptions = new Map([
        ["--config", "config"],
        ["--input", "input"],
    ]);
    const flagOptions = new Map([
        ["--dry-run", "dryRun"],
        ["--validate-only", "validateOnly"],
        ["--check-runtime", "runtimeCheckOnly"],
        ["--local-only", "localOnly"],
    ]);
    const seen = new Set();
    for (let index = 0; index < values.length; index += 1) {
        const argument = values[index];
        if (seen.has(argument)) {
            throw new Error(`Duplicate option: ${argument}`);
        }
        if (valueOptions.has(argument)) {
            const value = values[index + 1];
            if (!value || value.startsWith("--")) {
                throw new Error(`${argument} requires a value`);
            }
            parsed[valueOptions.get(argument)] = value;
            seen.add(argument);
            index += 1;
            continue;
        }
        if (flagOptions.has(argument)) {
            parsed[flagOptions.get(argument)] = true;
            seen.add(argument);
            continue;
        }
        throw new Error(`Unknown argument: ${argument}`);
    }
    const outputModes = [parsed.dryRun, parsed.validateOnly].filter(Boolean).length;
    if (outputModes > 1) {
        throw new Error("--dry-run and --validate-only are mutually exclusive");
    }
    if (parsed.runtimeCheckOnly &&
        (parsed.config || parsed.input || parsed.localOnly || outputModes > 0)) {
        throw new Error("--check-runtime cannot be combined with other options");
    }
    return parsed;
}
const options = parseArguments(args);
const configPath = options.config
    ? path.resolve(process.cwd(), options.config)
    : defaultConfigPath;
function assertSupportedRuntime() {
    const runtimeVersion = process.versions.node;
    const major = Number.parseInt(runtimeVersion.split(".", 1)[0] ?? "", 10);
    if (!Number.isInteger(major) || major < minimumNodeMajor) {
        throw new Error(`Unsupported Node.js v${runtimeVersion}. Node.js ${minimumNodeMajor} or later is required. ` +
            "Use a supported Node.js LTS release and retry.");
    }
}
function assertObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${label} must be an object`);
    }
}
function checksumPayload(payload) {
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
}
function verifyPayloadIntegrity(value, label, required) {
    const integrity = value.integrity;
    if (integrity === undefined) {
        if (required) {
            throw new Error(`${label} has no payload integrity checksum. Re-export it with the bundled snippet.`);
        }
        return false;
    }
    assertObject(integrity, `${label}.integrity`);
    if (integrity.algorithm !== "fnv1a32-utf16" ||
        typeof integrity.checksum !== "string") {
        throw new Error(`${label} has an unsupported payload integrity checksum`);
    }
    const { integrity: _integrity, ...payload } = value;
    const actual = checksumPayload(payload);
    if (actual !== integrity.checksum) {
        throw new Error(`${label} payload checksum mismatch: expected ${integrity.checksum}, got ${actual}. ` +
            "Discard this artifact and reacquire the same batch.");
    }
    return true;
}
async function readJson(filePath) {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text);
}
async function findJsonFiles(directory) {
    const files = [];
    async function visit(current) {
        let entries;
        try {
            entries = await readdir(current, { withFileTypes: true });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Cannot read input directory ${current}: ${message}`);
        }
        for (const entry of entries) {
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory()) {
                await visit(absolute);
            }
            else if (entry.isFile() && entry.name.endsWith(".json")) {
                files.push(absolute);
            }
        }
    }
    await visit(directory);
    return files.sort();
}
function validateConfig(raw) {
    assertObject(raw, "config");
    const requiredStrings = ["inputDirectory", "outputCss", "outputReport"];
    for (const key of requiredStrings) {
        if (typeof raw[key] !== "string" || raw[key].length === 0) {
            throw new Error(`config.${key} must be a non-empty string`);
        }
    }
    assertObject(raw.selectors, "config.selectors");
    assertObject(raw.extraction, "config.extraction");
    assertObject(raw.naming, "config.naming");
    assertObject(raw.float, "config.float");
    assertObject(raw.aliases, "config.aliases");
    assertObject(raw.validation, "config.validation");
    assertObject(raw.emit, "config.emit");
    if (typeof raw.validation.requirePayloadChecksum !== "boolean") {
        throw new Error("config.validation.requirePayloadChecksum must be a boolean");
    }
    if (!Number.isInteger(raw.extraction.maxBatchSize) ||
        raw.extraction.maxBatchSize < 1 ||
        raw.extraction.maxBatchSize > 200) {
        throw new Error("config.extraction.maxBatchSize must be an integer from 1 through 200");
    }
    if (!Number.isInteger(raw.extraction.maxPayloadBytes) ||
        raw.extraction.maxPayloadBytes < 1000 ||
        raw.extraction.maxPayloadBytes > 100000) {
        throw new Error("config.extraction.maxPayloadBytes must be an integer from 1000 through 100000");
    }
    for (const field of ["maxInventoryPayloadBytes", "maxPlanPayloadBytes"]) {
        if (!Number.isInteger(raw.extraction[field]) ||
            raw.extraction[field] < 1000 ||
            raw.extraction[field] > 100000) {
            throw new Error(`config.extraction.${field} must be an integer from 1000 through 100000`);
        }
    }
    return raw;
}
function isExportFile(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const candidate = value;
    return (candidate.schemaVersion === 2 &&
        candidate.kind === "figma-variable-export" &&
        !!candidate.source &&
        Array.isArray(candidate.collections));
}
function isExportPlanFile(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const candidate = value;
    return (candidate.schemaVersion === 2 &&
        candidate.kind === "figma-variable-export-plan" &&
        !!candidate.source &&
        Array.isArray(candidate.groups) &&
        Array.isArray(candidate.variableIds));
}
function isInventoryFile(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const candidate = value;
    return (candidate.schemaVersion === 2 &&
        candidate.kind === "figma-variable-inventory" &&
        !!candidate.local &&
        Array.isArray(candidate.libraryCollections));
}
function isPageListFile(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const candidate = value;
    return (candidate.schemaVersion === 2 &&
        candidate.kind === "figma-variable-page-list" &&
        Array.isArray(candidate.pages));
}
function isPageScanFile(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const candidate = value;
    return (candidate.schemaVersion === 2 &&
        candidate.kind === "figma-variable-page-scan" &&
        !!candidate.page &&
        Array.isArray(candidate.directVariableIds));
}
function collectionIdentity(sourceType, libraryName, key) {
    return `${sourceType}::${libraryName ?? ""}::${key}`;
}
function usageIdentityChecksum(collections) {
    const identities = collections
        .flatMap((collection) => collection.variables.map((variable) => ({
        id: variable.id,
        key: variable.key,
        collectionKey: collection.key,
    })))
        .sort((a, b) => a.key.localeCompare(b.key) || a.id.localeCompare(b.id));
    return checksumPayload(identities);
}
function validateVariableIdPlan(variableIds, expectedChecksum, expectedCount, label) {
    if (!Array.isArray(variableIds)) {
        throw new Error(`${label}.variableIds must be an array`);
    }
    const uniqueIds = new Set();
    for (const variableId of variableIds) {
        if (typeof variableId !== "string" ||
            variableId.length === 0 ||
            uniqueIds.has(variableId)) {
            throw new Error(`${label}.variableIds contains an invalid or duplicate ID`);
        }
        uniqueIds.add(variableId);
    }
    if (variableIds.length !== expectedCount ||
        typeof expectedChecksum !== "string" ||
        checksumPayload(variableIds) !== expectedChecksum) {
        throw new Error(`${label} Export plan is inconsistent`);
    }
    return variableIds;
}
function collectVariableAliases(value, destination) {
    if (!value || typeof value !== "object")
        return;
    if (value.type === "VARIABLE_ALIAS" &&
        typeof value.id === "string" &&
        value.id.length > 0) {
        destination.add(value.id);
        return;
    }
    if (Array.isArray(value)) {
        for (const entry of value)
            collectVariableAliases(entry, destination);
        return;
    }
    for (const entry of Object.values(value))
        collectVariableAliases(entry, destination);
}
function exportedVariablesById(collections) {
    const byId = new Map();
    for (const collection of collections) {
        for (const variable of collection.variables) {
            if (byId.has(variable.id)) {
                throw new Error(`Variable ID ${variable.id} appears more than once after batch merge`);
            }
            byId.set(variable.id, variable);
        }
    }
    return byId;
}
function validateExportPlan(config, planFiles, inventory, directVariableIds, localOnly) {
    if (!inventory)
        throw new Error("inventory.json is required to validate the Export plan");
    if (planFiles.length === 0) {
        if (!localOnly)
            throw new Error("No figma-variable-export-plan JSON files were found");
        const variableIds = validateVariableIdPlan(inventory.local.variableIds, inventory.local.variableIdsChecksum, inventory.local.variableCount, "inventory.local");
        if (checksumPayload(directVariableIds) !== inventory.usage.directVariableIdsChecksum ||
            directVariableIds.length !== inventory.usage.directVariableCount) {
            throw new Error("Page evidence does not match the Inventory direct-ID manifest");
        }
        return {
            variableIds,
            groups: [{
                    type: "local",
                    startIndex: 0,
                    variableCount: inventory.local.variableCount,
                    variableIdsChecksum: inventory.local.variableIdsChecksum,
                    usageChecksum: inventory.local.usageChecksum,
            }],
            batchCount: 0,
            source: "inventory",
        };
    }
    const expectedScope = localOnly ? "local-only" : "complete";
    const batches = [...planFiles].sort((a, b) => a.data.pagination.startIndex - b.data.pagination.startIndex);
    let expectedStart = 0;
    let expectedTotal = null;
    let expectedPlanChecksum = null;
    let expectedGroups = null;
    const variableIds = [];
    for (const { filePath, data } of batches) {
        const relativePath = path.relative(process.cwd(), filePath);
        assertObject(data.source, `${relativePath}.source`);
        assertObject(data.pagination, `${relativePath}.pagination`);
        if (data.source.fileKey !== inventory.fileKey ||
            data.source.fileName !== inventory.fileName ||
            data.source.scope !== expectedScope ||
            data.source.directVariableIdsChecksum !== inventory.usage.directVariableIdsChecksum ||
            data.source.usageChecksum !== inventory.usage.checksum ||
            data.source.resolvedVariableIdsChecksum !== inventory.usage.resolvedVariableIdsChecksum) {
            throw new Error(`Export plan source does not match Inventory in ${relativePath}`);
        }
        if (data.pagination.startIndex !== expectedStart ||
            data.pagination.batchSize !== config.extraction.maxBatchSize ||
            data.pagination.maxPayloadBytes !== config.extraction.maxPlanPayloadBytes ||
            data.pagination.returnedCount !== data.variableIds.length ||
            data.pagination.nextStartIndex !== data.pagination.startIndex + data.variableIds.length ||
            data.pagination.batchIdentityChecksum !== checksumPayload(data.variableIds)) {
            throw new Error(`Invalid Export-plan pagination in ${relativePath}`);
        }
        if (Buffer.byteLength(JSON.stringify(data), "utf8") > config.extraction.maxPlanPayloadBytes) {
            throw new Error(`Export-plan payload exceeds the configured byte limit in ${relativePath}`);
        }
        if (expectedTotal === null) {
            expectedTotal = data.pagination.total;
            expectedPlanChecksum = data.source.planChecksum;
            expectedGroups = data.groups;
        }
        if (data.pagination.total !== expectedTotal ||
            data.source.planChecksum !== expectedPlanChecksum ||
            JSON.stringify(data.groups) !== JSON.stringify(expectedGroups)) {
            throw new Error("Export-plan batches do not share one stable manifest");
        }
        variableIds.push(...validateVariableIdPlan(data.variableIds, data.pagination.batchIdentityChecksum, data.variableIds.length, relativePath));
        expectedStart = data.pagination.nextStartIndex;
    }
    const last = batches.at(-1).data.pagination;
    if (last.hasMore || expectedStart !== expectedTotal ||
        checksumPayload(variableIds) !== expectedPlanChecksum ||
        new Set(variableIds).size !== variableIds.length) {
        throw new Error("Export plan is incomplete or inconsistent");
    }
    const expectedVariableCount = localOnly
        ? inventory.local.variableCount
        : inventory.usage.resolvedVariableCount;
    if (variableIds.length !== expectedVariableCount) {
        throw new Error("Export-plan count does not match Inventory");
    }
    const groups = expectedGroups ?? [];
    const expectedGroupCount = 1 + (localOnly ? 0 : inventory.libraryCollections.length);
    if (groups.length !== expectedGroupCount) {
        throw new Error("Export-plan group count does not match Inventory");
    }
    let groupStart = 0;
    for (const [index, group] of groups.entries()) {
        assertObject(group, `Export-plan groups[${index}]`);
        const expected = index === 0 ? inventory.local : inventory.libraryCollections[index - 1];
        const expectedType = index === 0 ? "local" : "library";
        if (group.type !== expectedType ||
            group.startIndex !== groupStart ||
            group.variableCount !== expected.variableCount ||
            group.variableIdsChecksum !== expected.variableIdsChecksum ||
            group.usageChecksum !== expected.usageChecksum ||
            (index > 0 && (group.key !== expected.key ||
                (group.libraryName ?? "") !== (expected.libraryName ?? "")))) {
            throw new Error(`Export-plan group ${index} does not match Inventory`);
        }
        const groupIds = variableIds.slice(group.startIndex, group.startIndex + group.variableCount);
        if (checksumPayload(groupIds) !== group.variableIdsChecksum) {
            throw new Error(`Export-plan group ${index} ID checksum mismatch`);
        }
        groupStart += group.variableCount;
    }
    if (groupStart !== variableIds.length)
        throw new Error("Export-plan groups do not cover the selected plan");
    if (!localOnly && checksumPayload([...variableIds].sort()) !== inventory.usage.resolvedVariableIdsChecksum) {
        throw new Error("Complete Export plan does not cover the resolved usage set");
    }
    if (checksumPayload(directVariableIds) !== inventory.usage.directVariableIdsChecksum ||
        directVariableIds.length !== inventory.usage.directVariableCount) {
        throw new Error("Page evidence does not match the Inventory direct-ID manifest");
    }
    if (!localOnly) {
        const planSet = new Set(variableIds);
        if (directVariableIds.some((id) => !planSet.has(id)))
            throw new Error("Complete Export plan omits a direct Variable ID");
    }
    return { variableIds, groups, batchCount: batches.length, source: "mcp" };
}
function validateExportedAliasClosure(collections, exportPlan, directVariableIds, localOnly) {
    const expectedIds = exportPlan.variableIds;
    const expectedSet = new Set(expectedIds);
    const byId = exportedVariablesById(collections);
    const exportedIds = [...byId.keys()].sort();
    const sortedExpectedIds = [...expectedSet].sort();
    if (JSON.stringify(exportedIds) !== JSON.stringify(sortedExpectedIds)) {
        throw new Error("Exported Variable IDs do not match the Inventory Export plan");
    }
    for (const variable of byId.values()) {
        const aliasIds = new Set();
        collectVariableAliases(variable.valuesByMode, aliasIds);
        for (const aliasId of aliasIds) {
            if (!byId.has(aliasId)) {
                throw new Error(`Unresolved alias ${aliasId} from ${variable.name}`);
            }
        }
    }
    if (localOnly)
        return;
    const reachable = new Set();
    const pending = [...directVariableIds];
    for (let index = 0; index < pending.length; index += 1) {
        const variableId = pending[index];
        if (reachable.has(variableId))
            continue;
        const variable = byId.get(variableId);
        if (!variable) {
            throw new Error(`Direct Variable ${variableId} is missing from the complete Export`);
        }
        reachable.add(variableId);
        const aliasIds = new Set();
        collectVariableAliases(variable.valuesByMode, aliasIds);
        for (const aliasId of aliasIds) {
            if (!reachable.has(aliasId))
                pending.push(aliasId);
        }
    }
    if (JSON.stringify([...reachable].sort()) !== JSON.stringify(sortedExpectedIds)) {
        throw new Error("Exported Alias closure does not match the Inventory Export plan");
    }
}
function mergeExports(exportsWithPath) {
    const merged = new Map();
    for (const { filePath, data } of exportsWithPath) {
        for (const collection of data.collections) {
            const libraryName = collection.libraryName ?? data.source.libraryName;
            const identity = collectionIdentity(data.source.type, libraryName, collection.key);
            const existing = merged.get(identity);
            if (!existing) {
                merged.set(identity, {
                    ...collection,
                    libraryName,
                    sourceType: data.source.type,
                    sourceFiles: new Set([filePath]),
                    variables: [...collection.variables],
                });
                continue;
            }
            existing.sourceFiles.add(filePath);
            if (existing.name !== collection.name) {
                throw new Error(`Collection name mismatch for key ${collection.key}: ${existing.name} vs ${collection.name}`);
            }
            if ((!existing.modes || existing.modes.length === 0) && collection.modes.length > 0) {
                existing.modes = collection.modes;
                existing.defaultModeId = collection.defaultModeId;
                existing.id = collection.id;
            }
            else if (collection.modes.length > 0) {
                const current = JSON.stringify(existing.modes);
                const incoming = JSON.stringify(collection.modes);
                if (current !== incoming) {
                    throw new Error(`Mode mismatch across batches for collection ${collection.name}`);
                }
            }
            const byKey = new Map(existing.variables.map((variable) => [variable.key, variable]));
            for (const variable of collection.variables) {
                const duplicate = byKey.get(variable.key);
                if (duplicate) {
                    if (JSON.stringify(duplicate) !== JSON.stringify(variable)) {
                        throw new Error(`Variable key ${variable.key} has conflicting data across export files`);
                    }
                    continue;
                }
                existing.variables.push(variable);
                byKey.set(variable.key, variable);
            }
        }
    }
    return [...merged.values()].sort((a, b) => {
        const libraryCompare = (a.libraryName ?? "").localeCompare(b.libraryName ?? "");
        return libraryCompare || a.name.localeCompare(b.name);
    });
}
function exportErrorKey(error) {
    return typeof error.key === "string" && error.key.length > 0 ? error.key : null;
}
function validatePageCoverage(pageListEntry, pageScanFiles, inventory) {
    if (!inventory) {
        return {
            pageListPresent: pageListEntry !== null,
            pageCount: null,
            pageScansVerified: pageScanFiles.length,
            directVariableIds: [],
        };
    }
    if (!pageListEntry) {
        throw new Error("page-list.json was not found. Run the bundled page-list snippet before inventory.");
    }
    assertObject(inventory.usage, "inventory.usage");
    const pageList = pageListEntry.data;
    if (pageList.fileKey !== inventory.fileKey || pageList.fileName !== inventory.fileName) {
        throw new Error("Page list does not match inventory source");
    }
    if (!Number.isInteger(pageList.pageCount) ||
        pageList.pageCount < 0 ||
        pageList.pageCount !== pageList.pages.length) {
        throw new Error("Page list count is inconsistent");
    }
    const expectedPagesById = new Map();
    for (const [position, page] of pageList.pages.entries()) {
        assertObject(page, `pageList.pages[${position}]`);
        if (page.index !== position ||
            typeof page.id !== "string" ||
            page.id.length === 0 ||
            typeof page.name !== "string" ||
            expectedPagesById.has(page.id)) {
            throw new Error(`Invalid or duplicate page-list entry at index ${position}`);
        }
        expectedPagesById.set(page.id, page);
    }
    const scansByPageId = new Map();
    const directVariableIds = new Set();
    const explicitVariableModeCollectionIds = new Set();
    let nodeCount = 0;
    let nodesWithBindings = 0;
    let referencedStyleCount = 0;
    let referencedStylesWithBindings = 0;
    for (const { filePath, data } of pageScanFiles) {
        if (data.fileKey !== inventory.fileKey || data.fileName !== inventory.fileName) {
            throw new Error(`Page scan source mismatch in ${path.relative(process.cwd(), filePath)}`);
        }
        assertObject(data.page, `${path.relative(process.cwd(), filePath)}.page`);
        const expected = expectedPagesById.get(data.page.id);
        if (!expected ||
            scansByPageId.has(data.page.id) ||
            data.page.index !== expected.index ||
            data.page.name !== expected.name) {
            throw new Error(`Unexpected or duplicate page scan in ${path.relative(process.cwd(), filePath)}`);
        }
        scansByPageId.set(data.page.id, data);
        if (!Array.isArray(data.errors) || data.errors.length > 0) {
            throw new Error(`Page scan contains errors in ${path.relative(process.cwd(), filePath)}`);
        }
        const pageVariableIds = new Set();
        for (const variableId of data.directVariableIds) {
            if (typeof variableId !== "string" ||
                variableId.length === 0 ||
                pageVariableIds.has(variableId)) {
                throw new Error(`Invalid or duplicate Variable ID in ${path.relative(process.cwd(), filePath)}`);
            }
            pageVariableIds.add(variableId);
            directVariableIds.add(variableId);
        }
        if (JSON.stringify(data.directVariableIds) !==
            JSON.stringify([...pageVariableIds].sort())) {
            throw new Error(`Page Variable IDs are not sorted in ${path.relative(process.cwd(), filePath)}`);
        }
        if (!Array.isArray(data.explicitVariableModeCollectionIds)) {
            throw new Error(`Page explicit mode Collection IDs are invalid in ${path.relative(process.cwd(), filePath)}`);
        }
        const pageExplicitCollectionIds = new Set();
        for (const collectionId of data.explicitVariableModeCollectionIds) {
            if (typeof collectionId !== "string" ||
                collectionId.length === 0 ||
                pageExplicitCollectionIds.has(collectionId)) {
                throw new Error(`Invalid or duplicate explicit mode Collection ID in ${path.relative(process.cwd(), filePath)}`);
            }
            pageExplicitCollectionIds.add(collectionId);
            explicitVariableModeCollectionIds.add(collectionId);
        }
        if (JSON.stringify(data.explicitVariableModeCollectionIds) !==
            JSON.stringify([...pageExplicitCollectionIds].sort())) {
            throw new Error(`Page explicit mode Collection IDs are not sorted in ${path.relative(process.cwd(), filePath)}`);
        }
        const countFields = [
            "nodes",
            "nodesWithBindings",
            "referencedStyles",
            "referencedStylesWithBindings",
            "directVariables",
            "explicitVariableModeCollections",
            "errors",
        ];
        if (!data.counts || countFields.some((field) =>
            !Number.isInteger(data.counts[field]) || data.counts[field] < 0) ||
            data.counts.directVariables !== data.directVariableIds.length ||
            data.counts.explicitVariableModeCollections !==
                data.explicitVariableModeCollectionIds.length ||
            data.counts.errors !== data.errors.length) {
            throw new Error(`Page scan counts are inconsistent in ${path.relative(process.cwd(), filePath)}`);
        }
        nodeCount += data.counts.nodes;
        nodesWithBindings += data.counts.nodesWithBindings;
        referencedStyleCount += data.counts.referencedStyles;
        referencedStylesWithBindings += data.counts.referencedStylesWithBindings;
    }
    if (scansByPageId.size !== expectedPagesById.size) {
        const missing = [...expectedPagesById.keys()].filter((pageId) => !scansByPageId.has(pageId));
        throw new Error(`Page scan coverage is incomplete: missing ${missing.join(", ")}`);
    }
    const orderedPageEvidence = pageList.pages.map((page) => ({
        index: page.index,
        id: page.id,
        name: page.name,
        scanChecksum: scansByPageId.get(page.id).integrity.checksum,
    }));
    const sortedDirectVariableIds = [...directVariableIds].sort();
    const sortedExplicitVariableModeCollectionIds = [
        ...explicitVariableModeCollectionIds,
    ].sort();
    if (inventory.usage.pageCount !== pageList.pageCount ||
        inventory.usage.scannedPageCount !== scansByPageId.size ||
        inventory.usage.pageListChecksum !== pageList.integrity.checksum ||
        inventory.usage.pageScansChecksum !== checksumPayload(orderedPageEvidence) ||
        inventory.usage.directVariableIdsChecksum !== checksumPayload(sortedDirectVariableIds) ||
        inventory.usage.directVariableCount !== sortedDirectVariableIds.length ||
        JSON.stringify(inventory.usage.explicitVariableModeCollectionIds) !==
            JSON.stringify(sortedExplicitVariableModeCollectionIds) ||
        inventory.usage.nodeCount !== nodeCount ||
        inventory.usage.nodesWithBindings !== nodesWithBindings ||
        inventory.usage.referencedStyleCount !== referencedStyleCount ||
        inventory.usage.referencedStylesWithBindings !== referencedStylesWithBindings) {
        throw new Error("Page evidence does not match the inventory usage manifest");
    }
    return {
        pageListPresent: true,
        pageCount: pageList.pageCount,
        pageScansVerified: pageScanFiles.length,
        directVariableIds: sortedDirectVariableIds,
    };
}
function validateCompleteness(config, exportFiles, collections, inventory, exportPlan, directVariableIds, localOnly) {
    if (config.validation.requireInventory && !inventory) {
        throw new Error("inventory.json was not found. Run the preflight/inventory MCP snippet before generation.");
    }
    const sourceFileKey = inventory?.fileKey ??
        exportFiles[0]?.data.source.fileKey ??
        null;
    if (typeof sourceFileKey !== "string" || sourceFileKey.length === 0) {
        throw new Error("Source Figma fileKey is missing. Re-export with the bundled snippets.");
    }
    if (inventory && inventory.fileKey !== sourceFileKey) {
        throw new Error("Inventory source Figma fileKey is inconsistent");
    }
    if (inventory) {
        assertObject(inventory.usage, "inventory.usage");
        if (!Array.isArray(inventory.usage.errors)) {
            throw new Error("inventory.usage.errors must be an array");
        }
        if (typeof inventory.usage.checksum !== "string" || inventory.usage.checksum.length === 0) {
            throw new Error("inventory.usage.checksum is missing");
        }
        if (typeof inventory.local.usageChecksum !== "string" || inventory.local.usageChecksum.length === 0) {
            throw new Error("inventory.local.usageChecksum is missing");
        }
        if (typeof inventory.usage.directVariableIdsChecksum !== "string" ||
            inventory.usage.directVariableIdsChecksum.length === 0 ||
            !Number.isInteger(inventory.usage.directVariableCount) ||
            inventory.usage.directVariableCount < 0) {
            throw new Error("Inventory direct Variable ID manifest is inconsistent");
        }
        if (inventory.usage.directResolvedVariableCount + inventory.usage.aliasDependencyCount !==
            inventory.usage.resolvedVariableCount) {
            throw new Error("Inventory usage counts are inconsistent");
        }
        if (typeof inventory.local.variableIdsChecksum !== "string" ||
            inventory.local.variableIdsChecksum.length === 0) {
            throw new Error("Inventory local Export-plan checksum is missing");
        }
        const libraryKeys = new Set();
        for (const [index, collection] of inventory.libraryCollections.entries()) {
            if (typeof collection.key !== "string" ||
                collection.key.length === 0 ||
                libraryKeys.has(collection.key)) {
                throw new Error(`inventory.libraryCollections[${index}] has an invalid or duplicate key`);
            }
            libraryKeys.add(collection.key);
            if (typeof collection.variableIdsChecksum !== "string" ||
                collection.variableIdsChecksum.length === 0) {
                throw new Error(`inventory.libraryCollections[${index}] has no Export-plan checksum`);
            }
        }
        assertObject(inventory.namingPreflight, "inventory.namingPreflight");
        assertObject(inventory.namingPreflight.config, "inventory.namingPreflight.config");
        if ([
            "preferWebCodeSyntax",
            "includeLibraryName",
            "includeCollectionName",
            "prefix",
        ].some((field) => inventory.namingPreflight.config[field] !==
            config.naming[field])) {
            throw new Error("Naming configuration changed after Inventory. Re-run Inventory before Export.");
        }
    }
    const usageErrors = inventory?.usage.errors ?? [];
    if (usageErrors.length > 0) {
        const preview = usageErrors
            .slice(0, 10)
            .map((error) => `${error.variableId ?? "unknown-id"}: ${error.message ?? "unknown error"}`)
            .join("\n");
        throw new Error(`Variable usage scan contains ${usageErrors.length} unresolved reference(s).\n${preview}` +
            (usageErrors.length > 10 ? "\n..." : ""));
    }
    for (const { filePath, data } of exportFiles) {
        if (data.source.fileKey !== sourceFileKey) {
            throw new Error(`Source Figma fileKey mismatch in ${path.relative(process.cwd(), filePath)}: ` +
                `expected ${sourceFileKey}, got ${data.source.fileKey ?? "missing"}`);
        }
        if (inventory && data.source.directVariableIdsChecksum !==
            inventory.usage.directVariableIdsChecksum) {
            throw new Error(`Direct Variable ID manifest mismatch in ${path.relative(process.cwd(), filePath)}`);
        }
        if (inventory) {
            const expectedPlan = data.source.type === "local"
                ? inventory.local
                : inventory.libraryCollections.find((collection) => collection.key === data.source.libraryCollectionKey &&
                    (collection.libraryName ?? "") ===
                        (data.source.libraryName ?? ""));
            if (!expectedPlan) {
                throw new Error(`Export plan was not found for ${path.relative(process.cwd(), filePath)}`);
            }
            if (data.source.variableIdsChecksum !== expectedPlan.variableIdsChecksum ||
                data.source.usageChecksum !== expectedPlan.usageChecksum) {
                throw new Error(`Export plan checksum mismatch in ${path.relative(process.cwd(), filePath)}`);
            }
            if (data.source.batchUsageChecksum !== usageIdentityChecksum(data.collections)) {
                throw new Error(`Batch identity checksum mismatch in ${path.relative(process.cwd(), filePath)}`);
            }
        }
        if (!data.pagination ||
            data.pagination.batchSize !== config.extraction.maxBatchSize ||
            data.pagination.maxPayloadBytes !==
                config.extraction.maxPayloadBytes) {
            throw new Error(`Extraction limits do not match the selected configuration in ${path.relative(process.cwd(), filePath)}`);
        }
    }
    const allErrors = exportFiles.flatMap(({ filePath, data }) => (data.errors ?? []).map((error) => ({ filePath, error })));
    if (allErrors.length > 0 && config.validation.extractionErrors === "error") {
        const preview = allErrors
            .slice(0, 10)
            .map(({ filePath, error }) => {
            const key = exportErrorKey(error) ?? "unknown-key";
            return `${path.relative(process.cwd(), filePath)}: ${key}: ${error.message ?? "unknown error"}`;
        })
            .join("\n");
        throw new Error(`Variable extraction contains ${allErrors.length} error(s).\n${preview}` +
            (allErrors.length > 10 ? "\n..." : ""));
    }
    const localCollections = collections.filter((collection) => collection.sourceType === "local");
    const localExported = localCollections.reduce((sum, collection) => sum + collection.variables.length, 0);
    if (inventory && localExported !== inventory.local.variableCount) {
        throw new Error(`Local Variable count mismatch: inventory=${inventory.local.variableCount}, exported=${localExported}`);
    }
    if (inventory && usageIdentityChecksum(localCollections) !== inventory.local.usageChecksum) {
        throw new Error("Local exported Variable identities do not match the inventory usage set");
    }
    const localFiles = exportFiles.filter(({ data }) => data.source.type === "local");
    for (const { filePath, data } of localFiles) {
        if (inventory && data.source.usageChecksum !== inventory.local.usageChecksum) {
            throw new Error(`Local usage set changed after inventory in ${path.relative(process.cwd(), filePath)}. ` +
                "Re-run inventory and all exports from one stable Figma revision.");
        }
    }
    const paginatedLocalFiles = localFiles.filter(({ data }) => data.pagination !== undefined);
    if (paginatedLocalFiles.length > 0 && paginatedLocalFiles.length !== localFiles.length) {
        throw new Error("Local export mixes paginated and non-paginated files. Remove stale local export files.");
    }
    if (paginatedLocalFiles.length > 0) {
        const batches = [...paginatedLocalFiles].sort((a, b) => (a.data.pagination?.startIndex ?? 0) -
            (b.data.pagination?.startIndex ?? 0));
        let expectedStart = 0;
        let expectedTotal = null;
        for (const { filePath, data } of batches) {
            const pagination = data.pagination;
            if (!pagination)
                continue;
            if (pagination.startIndex !== expectedStart) {
                throw new Error(`Local batch gap or duplicate: expected start ${expectedStart}, ` +
                    `got ${pagination.startIndex} in ${path.relative(process.cwd(), filePath)}`);
            }
            if (expectedTotal === null)
                expectedTotal = pagination.total;
            if (pagination.total !== expectedTotal) {
                throw new Error("Inconsistent pagination total across local export batches");
            }
            const exportedInBatch = data.collections.reduce((sum, collection) => sum + collection.variables.length, 0);
            const errorCount = data.errors?.length ?? 0;
            if (pagination.returnedDescriptorCount !==
                pagination.successCount + pagination.errorCount) {
                throw new Error(`Invalid local batch counts in ${path.relative(process.cwd(), filePath)}`);
            }
            if (exportedInBatch !== pagination.successCount ||
                errorCount !== pagination.errorCount) {
                throw new Error(`Local batch payload count mismatch in ${path.relative(process.cwd(), filePath)}`);
            }
            if (pagination.nextStartIndex !==
                pagination.startIndex + pagination.returnedDescriptorCount) {
                throw new Error(`Invalid local nextStartIndex in ${path.relative(process.cwd(), filePath)}`);
            }
            expectedStart = pagination.nextStartIndex;
        }
        const last = batches.at(-1)?.data.pagination;
        const inventoryTotal = inventory?.local.variableCount ?? expectedTotal;
        if (!last || last.hasMore || expectedStart !== inventoryTotal) {
            throw new Error(`Local export is incomplete: covered=${expectedStart}, ` +
                `expected=${inventoryTotal ?? "unknown"}, ` +
                `finalHasMore=${last?.hasMore ?? "missing"}`);
        }
    }
    let libraryExpected = 0;
    let libraryExported = 0;
    let libraryCollectionsChecked = 0;
    if (inventory && !localOnly) {
        for (const expected of inventory.libraryCollections) {
            if (expected.error) {
                throw new Error(`Inventory failed for ${expected.libraryName}/${expected.name}: ${expected.error}`);
            }
            if (expected.variableCount === null) {
                throw new Error(`Inventory has no variable count for ${expected.libraryName}/${expected.name}`);
            }
            if (typeof expected.usageChecksum !== "string" || expected.usageChecksum.length === 0) {
                throw new Error(`Inventory has no usage checksum for ${expected.libraryName ?? "Remote Library"}/${expected.name}`);
            }
            libraryExpected += expected.variableCount;
            libraryCollectionsChecked += 1;
            const expectedLibraryName = expected.libraryName ?? "";
            const matchingCollections = collections.filter((collection) => collection.sourceType === "library" &&
                collection.key === expected.key &&
                (collection.libraryName ?? "") === expectedLibraryName);
            const exportedKeys = new Set(matchingCollections.flatMap((collection) => collection.variables.map((variable) => variable.key)));
            if (usageIdentityChecksum(matchingCollections) !== expected.usageChecksum) {
                throw new Error(`Library exported Variable identities do not match inventory for ` +
                    `${expected.libraryName ?? "Remote Library"}/${expected.name}`);
            }
            const matchingFiles = exportFiles.filter(({ data }) => data.source.type === "library" &&
                data.source.libraryCollectionKey === expected.key &&
                (data.source.libraryName ?? "") === expectedLibraryName);
            for (const { filePath, data } of matchingFiles) {
                if (data.source.usageChecksum !== expected.usageChecksum) {
                    throw new Error(`Library usage set changed after inventory for ${expected.libraryName ?? "Remote Library"}/${expected.name} ` +
                        `in ${path.relative(process.cwd(), filePath)}. Re-run inventory and this Collection export.`);
                }
            }
            const errorKeys = new Set(matchingFiles.flatMap(({ data }) => (data.errors ?? [])
                .map(exportErrorKey)
                .filter((key) => key !== null)));
            libraryExported += exportedKeys.size;
            if (exportedKeys.size + errorKeys.size !== expected.variableCount) {
                throw new Error(`Library Variable count mismatch for ${expected.libraryName}/${expected.name}: ` +
                    `inventory=${expected.variableCount}, success=${exportedKeys.size}, errors=${errorKeys.size}`);
            }
            if (!config.validation.requireCompleteLibraryBatches || expected.variableCount === 0) {
                continue;
            }
            const batches = matchingFiles
                .filter(({ data }) => data.pagination !== undefined)
                .sort((a, b) => (a.data.pagination?.startIndex ?? 0) -
                (b.data.pagination?.startIndex ?? 0));
            if (batches.length === 0) {
                throw new Error(`No paginated export found for ${expected.libraryName}/${expected.name}`);
            }
            let expectedStart = 0;
            let expectedTotal = null;
            for (const { filePath, data } of batches) {
                const pagination = data.pagination;
                if (!pagination)
                    continue;
                if (pagination.startIndex !== expectedStart) {
                    throw new Error(`Library batch gap or duplicate for ${expected.libraryName}/${expected.name}: ` +
                        `expected start ${expectedStart}, got ${pagination.startIndex} in ` +
                        path.relative(process.cwd(), filePath));
                }
                if (expectedTotal === null)
                    expectedTotal = pagination.total;
                if (pagination.total !== expectedTotal) {
                    throw new Error(`Inconsistent pagination total for ${expected.libraryName}/${expected.name}`);
                }
                if (pagination.returnedDescriptorCount !==
                    pagination.successCount + pagination.errorCount) {
                    throw new Error(`Invalid batch counts in ${path.relative(process.cwd(), filePath)}`);
                }
                if (pagination.nextStartIndex !==
                    pagination.startIndex + pagination.returnedDescriptorCount) {
                    throw new Error(`Invalid nextStartIndex in ${path.relative(process.cwd(), filePath)}`);
                }
                expectedStart = pagination.nextStartIndex;
            }
            const last = batches.at(-1)?.data.pagination;
            if (!last || last.hasMore || expectedStart !== expected.variableCount) {
                throw new Error(`Library export is incomplete for ${expected.libraryName}/${expected.name}: ` +
                    `covered=${expectedStart}, expected=${expected.variableCount}, ` +
                    `finalHasMore=${last?.hasMore ?? "missing"}`);
            }
        }
        if (usageIdentityChecksum(collections) !== inventory.usage.checksum) {
            throw new Error("Complete exported Variable identities do not match the inventory usage closure");
        }
    }
    else if (!localOnly) {
        libraryExported = collections
            .filter((collection) => collection.sourceType === "library")
            .reduce((sum, collection) => sum + collection.variables.length, 0);
    }
    const excludedLibraryCollections = localOnly
        ? inventory?.libraryCollections.length ?? null
        : 0;
    const excludedLibraryInventoryErrors = localOnly && inventory
        ? inventory.libraryCollections
            .filter((collection) => collection.error || !Number.isInteger(collection.variableCount))
            .map((collection) => ({
            libraryName: collection.libraryName,
            collectionName: collection.name,
            collectionKey: collection.key,
            error: collection.error ?? "Variable count is unavailable",
        }))
        : [];
    const excludedLibraryVariables = localOnly && inventory && excludedLibraryInventoryErrors.length === 0
        ? inventory.libraryCollections.reduce((sum, collection) => sum + collection.variableCount, 0)
        : localOnly
            ? null
            : 0;
    const enabledLibraryCollections = inventory?.enabledLibraryCollections ?? [];
    const unusedEnabledLibraryCollections = enabledLibraryCollections.filter((collection) => collection.usedVariableCount === 0).length;
    if (inventory) {
        validateExportedAliasClosure(collections, exportPlan, directVariableIds, localOnly);
    }
    return {
        sourceFileKey,
        scope: localOnly ? "local-usage-only" : "complete-usage",
        inventoryPresent: inventory !== null,
        exportPlanBatches: exportPlan.batchCount,
        exportPlanSource: exportPlan.source,
        localExpected: inventory?.local.variableCount ?? null,
        localExported,
        libraryExpected,
        libraryExported,
        extractionErrorCount: allErrors.length,
        libraryCollectionsChecked,
        excludedLibraryCollections,
        excludedLibraryVariables,
        excludedLibraryInventoryErrors,
        enabledLibraryCollections: enabledLibraryCollections.length,
        unusedEnabledLibraryCollections,
    };
}
function codePointSlug(value) {
    const normalized = value.normalize("NFKC");
    const parts = [];
    let pendingSeparator = false;
    for (const character of normalized) {
        if (/^[A-Za-z0-9]$/.test(character)) {
            if (pendingSeparator && parts.length > 0 && parts.at(-1) !== "-")
                parts.push("-");
            parts.push(character.toLowerCase());
            pendingSeparator = false;
            continue;
        }
        if (/^[\s/_:.]+$/.test(character) || character === "-") {
            pendingSeparator = true;
            continue;
        }
        if (pendingSeparator && parts.length > 0 && parts.at(-1) !== "-")
            parts.push("-");
        const codePoint = character.codePointAt(0);
        parts.push(codePoint === undefined ? "u0" : `u${codePoint.toString(16)}`);
        pendingSeparator = true;
    }
    return parts.join("").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function extractCssNameFromWebSyntax(webSyntax) {
    if (!webSyntax)
        return null;
    const trimmed = webSyntax.trim();
    const varMatch = trimmed.match(/^var\(\s*(--[A-Za-z0-9_-]+)(?:\s*,[^)]*)?\s*\)$/);
    if (varMatch?.[1])
        return varMatch[1];
    if (/^--[A-Za-z0-9_-]+$/.test(trimmed))
        return trimmed;
    return null;
}
function buildDerivedCssName(config, collection, variable) {
    const segments = [];
    if (config.naming.prefix)
        segments.push(config.naming.prefix);
    if (config.naming.includeLibraryName && collection.libraryName) {
        segments.push(collection.libraryName);
    }
    if (config.naming.includeCollectionName)
        segments.push(collection.name);
    segments.push(variable.name);
    const slug = codePointSlug(segments.join("/"));
    if (!slug) {
        throw new Error(`Could not create CSS name for variable ${variable.name} (${variable.key})`);
    }
    return `--${slug}`;
}
function buildCssName(config, collection, variable) {
    const webSyntax = variable.codeSyntax?.WEB;
    if (config.naming.preferWebCodeSyntax) {
        const fromSyntax = extractCssNameFromWebSyntax(webSyntax);
        if (fromSyntax)
            return {
                cssName: fromSyntax,
                source: "web",
                ignoredInvalidWebSyntax: false,
            };
    }
    return {
        cssName: buildDerivedCssName(config, collection, variable),
        source: "derived",
        ignoredInvalidWebSyntax: config.naming.preferWebCodeSyntax &&
            typeof webSyntax === "string" &&
            webSyntax.trim().length > 0,
    };
}
function selectorForMode(config, collection, mode) {
    const collectionSpecific = config.selectors.modes[`${collection.name}/${mode.name}`];
    if (collectionSpecific !== undefined)
        return collectionSpecific;
    const globalMode = config.selectors.modes[mode.name];
    if (globalMode !== undefined)
        return globalMode;
    if (collection.defaultModeId === mode.modeId)
        return config.selectors.default;
    switch (config.selectors.unknownModeStrategy) {
        case "skip":
            return null;
        case "error":
            throw new Error(`No selector configured for mode ${collection.name}/${mode.name}`);
        case "attribute":
            return `[data-figma-mode="${codePointSlug(mode.name)}"]`;
    }
}
function isAlias(value) {
    return (!!value &&
        typeof value === "object" &&
        "type" in value &&
        value.type === "VARIABLE_ALIAS" &&
        "id" in value &&
        typeof value.id === "string");
}
function isColor(value) {
    return (!!value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "r" in value &&
        "g" in value &&
        "b" in value &&
        typeof value.r === "number" &&
        typeof value.g === "number" &&
        typeof value.b === "number");
}
function clampByte(channel) {
    return Math.max(0, Math.min(255, Math.round(channel * 255)));
}
function formatColor(value) {
    const r = clampByte(value.r);
    const g = clampByte(value.g);
    const b = clampByte(value.b);
    const alpha = value.a ?? 1;
    if (alpha >= 0.999999)
        return `rgb(${r} ${g} ${b})`;
    const roundedAlpha = Math.round(Math.max(0, Math.min(1, alpha)) * 10000) / 10000;
    return `rgb(${r} ${g} ${b} / ${roundedAlpha})`;
}
function unitForFloat(config, context) {
    const fullName = `${context.collection.name}/${context.variable.name}`;
    for (const rule of config.float.nameRules) {
        let regex;
        try {
            regex = new RegExp(rule.pattern, "i");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid FLOAT name rule regex ${rule.pattern}: ${message}`);
        }
        if (regex.test(fullName))
            return rule.unit;
    }
    const scopes = new Set(context.variable.scopes ?? []);
    for (const rule of config.float.scopeRules) {
        if (rule.scopes.some((scope) => scopes.has(scope)))
            return rule.unit;
    }
    if (config.float.unknownUnit === "unitless")
        return "";
    if (config.float.unknownUnit === "px")
        return "px";
    throw new Error(`Unknown FLOAT unit for ${context.collection.name}/${context.variable.name} ` +
        `(key=${context.variable.key}, scopes=${[...scopes].join(",") || "none"})`);
}
function formatValue(config, context, value, byId, warnings) {
    if (isAlias(value)) {
        const target = byId.get(value.id);
        if (!target) {
            const message = `Unresolved alias ${value.id} from ${context.collection.name}/${context.variable.name}`;
            if (config.aliases.unresolved === "error")
                throw new Error(message);
            warnings.push({
                code: "UNRESOLVED_ALIAS",
                message,
                variableKey: context.variable.key,
                variableName: context.variable.name,
                collectionKey: context.collection.key,
            });
            return null;
        }
        return `var(${target.cssName})`;
    }
    switch (context.variable.resolvedType) {
        case "COLOR":
            if (!isColor(value)) {
                throw new Error(`Expected COLOR value for ${context.variable.name}`);
            }
            return formatColor(value);
        case "FLOAT":
            if (typeof value !== "number") {
                throw new Error(`Expected FLOAT value for ${context.variable.name}`);
            }
            return `${Number.isInteger(value) ? value : Number(value.toFixed(6))}${unitForFloat(config, context)}`;
        case "STRING":
            if (!config.emit.strings)
                return null;
            if (typeof value !== "string") {
                throw new Error(`Expected STRING value for ${context.variable.name}`);
            }
            return JSON.stringify(value);
        case "BOOLEAN":
            if (!config.emit.booleans)
                return null;
            if (typeof value !== "boolean") {
                throw new Error(`Expected BOOLEAN value for ${context.variable.name}`);
            }
            return value ? "true" : "false";
        default:
            warnings.push({
                code: "UNSUPPORTED_TYPE",
                message: `Skipped unsupported type ${context.variable.resolvedType}`,
                variableKey: context.variable.key,
                variableName: context.variable.name,
                collectionKey: context.collection.key,
            });
            return null;
    }
}
function commentFor(context) {
    const source = context.collection.sourceType === "library"
        ? `${context.collection.libraryName ?? "Library"} / ${context.collection.name}`
        : `Local / ${context.collection.name}`;
    return `${source} / ${context.variable.name}`.replace(/\*\//g, "* / ");
}
function generate(config, collections, sourceFiles) {
    const warnings = [];
    const contexts = [];
    const byId = new Map();
    const byCssName = new Map();
    const cssNameSources = { web: 0, derived: 0 };
    for (const collection of collections) {
        if (collection.variables.length > 0 && (!collection.modes || collection.modes.length === 0)) {
            throw new Error(`Collection ${collection.name} has no modes. Re-export its library batch.`);
        }
        for (const variable of collection.variables) {
            const nameResult = buildCssName(config, collection, variable);
            const cssName = nameResult.cssName;
            const context = {
                variable,
                collection,
                cssName,
                cssNameSource: nameResult.source,
            };
            cssNameSources[nameResult.source] += 1;
            if (nameResult.ignoredInvalidWebSyntax) {
                warnings.push({
                    code: "INVALID_WEB_CODE_SYNTAX",
                    message: `Ignored invalid WEB codeSyntax for ${collection.name}/${variable.name}`,
                    variableKey: variable.key,
                    variableName: variable.name,
                    collectionKey: collection.key,
                });
            }
            const nameCollision = byCssName.get(cssName);
            if (nameCollision && nameCollision.variable.key !== variable.key) {
                throw new Error(`CSS name collision ${cssName}: ` +
                    `${nameCollision.collection.name}/${nameCollision.variable.name} ` +
                    `(source=${nameCollision.cssNameSource}) and ` +
                    `${collection.name}/${variable.name} (source=${context.cssNameSource})`);
            }
            byCssName.set(cssName, context);
            if (byId.has(variable.id) && byId.get(variable.id)?.variable.key !== variable.key) {
                throw new Error(`Variable ID collision: ${variable.id}`);
            }
            byId.set(variable.id, context);
            contexts.push(context);
        }
    }
    const selectorDeclarations = new Map();
    let aliasCount = 0;
    const typeCounts = {};
    for (const context of contexts) {
        typeCounts[context.variable.resolvedType] = (typeCounts[context.variable.resolvedType] ?? 0) + 1;
        const modeById = new Map(context.collection.modes.map((mode) => [mode.modeId, mode]));
        for (const [modeId, rawValue] of Object.entries(context.variable.valuesByMode)) {
            const mode = modeById.get(modeId);
            if (!mode) {
                throw new Error(`Mode ${modeId} used by ${context.variable.name} is missing from collection ${context.collection.name}`);
            }
            const selector = selectorForMode(config, context.collection, mode);
            if (selector === null)
                continue;
            if (isAlias(rawValue))
                aliasCount += 1;
            const value = formatValue(config, context, rawValue, byId, warnings);
            if (value === null)
                continue;
            const declarations = selectorDeclarations.get(selector) ?? new Map();
            const existing = declarations.get(context.cssName);
            if (existing && existing.value !== value) {
                throw new Error(`Conflicting declaration for ${context.cssName} in ${selector}: ` +
                    `${existing.value} vs ${value}`);
            }
            declarations.set(context.cssName, { value, context });
            selectorDeclarations.set(selector, declarations);
        }
    }
    const configuredSelectorOrder = [
        config.selectors.default,
        ...Object.values(config.selectors.modes).filter((value) => typeof value === "string"),
    ];
    const uniqueConfigured = [...new Set(configuredSelectorOrder)];
    const selectors = [...selectorDeclarations.keys()].sort((a, b) => {
        const ai = uniqueConfigured.indexOf(a);
        const bi = uniqueConfigured.indexOf(b);
        if (ai !== -1 || bi !== -1) {
            if (ai === -1)
                return 1;
            if (bi === -1)
                return -1;
            return ai - bi;
        }
        return a.localeCompare(b);
    });
    const lines = [
        "/*",
        " * Generated from Figma Variables.",
        " * Do not edit this file directly.",
        " */",
        "",
    ];
    let declarationCount = 0;
    for (const selector of selectors) {
        lines.push(`${selector} {`);
        const declarations = [...(selectorDeclarations.get(selector)?.entries() ?? [])].sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
        for (const [name, entry] of declarations) {
            if (config.emit.comments)
                lines.push(`  /* ${commentFor(entry.context)} */`);
            lines.push(`  ${name}: ${entry.value};`);
            declarationCount += 1;
        }
        lines.push("}", "");
    }
    const css = `${lines.join("\n").trimEnd()}\n`;
    const report = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        sourceFiles: sourceFiles.map((file) => path.relative(process.cwd(), file)),
        counts: {
            collections: collections.length,
            localCollections: collections.filter((collection) => collection.sourceType === "local").length,
            libraryCollections: collections.filter((collection) => collection.sourceType === "library").length,
            variables: contexts.length,
            declarations: declarationCount,
            selectors: selectors.length,
            aliases: aliasCount,
            cssNameSources,
            byType: typeCounts,
        },
        selectors,
        warnings,
    };
    return { css, report };
}
async function removeTemporaryJson(files) {
    for (const filePath of [...new Set(files)]) {
        await unlink(filePath);
    }
}
async function removeEmptyDirectories(rootDirectory) {
    const removed = [];
    async function visit(directory) {
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                await visit(path.join(directory, entry.name));
            }
        }
        const remaining = await readdir(directory);
        if (remaining.length > 0)
            return;
        try {
            await rmdir(directory);
            removed.push(directory);
        }
        catch (error) {
            if (error && typeof error === "object" &&
                "code" in error &&
                (error.code === "ENOENT" || error.code === "ENOTEMPTY")) {
                return;
            }
            throw error;
        }
    }
    await visit(rootDirectory);
    return removed;
}

function summarizeWarningsForStdout(warnings) {
    const summaries = new Map();
    for (const warning of warnings) {
        const code = typeof warning?.code === "string" ? warning.code : "UNKNOWN_WARNING";
        const scope = typeof warning?.scope === "string" ? warning.scope : null;
        const key = `${code}\u0000${scope ?? ""}`;
        const summary = summaries.get(key) ?? { code, count: 0 };
        summary.count += 1;
        if (scope !== null)
            summary.scope = scope;
        summaries.set(key, summary);
    }
    return [...summaries.values()].sort((left, right) => left.code.localeCompare(right.code) ||
        String(left.scope ?? "").localeCompare(String(right.scope ?? "")));
}

function sanitizeCompletenessForStdout(completeness) {
    const { sourceFileKey: _sourceFileKey, excludedLibraryInventoryErrors, ...safe } = completeness;
    return {
        ...safe,
        excludedLibraryInventoryErrorCount: Array.isArray(excludedLibraryInventoryErrors)
            ? excludedLibraryInventoryErrors.length
            : 0,
    };
}
async function main() {
    assertSupportedRuntime();
    if (options.runtimeCheckOnly) {
        console.log(`Node.js runtime is compatible: ${process.version} (required: >=${minimumNodeMajor}).`);
        return;
    }
    const config = validateConfig(await readJson(configPath));
    const inputDirectory = options.input
        ? path.resolve(process.cwd(), options.input)
        : path.resolve(process.cwd(), config.inputDirectory);
    const outputCss = path.resolve(process.cwd(), config.outputCss);
    const outputReport = path.resolve(process.cwd(), config.outputReport);
    const reportRelativeToInput = path.relative(inputDirectory, outputReport);
    if (outputCss === outputReport) {
        throw new Error("config.outputCss and config.outputReport must resolve to different files");
    }
    if (reportRelativeToInput === "" ||
        (!reportRelativeToInput.startsWith(`..${path.sep}`) &&
            reportRelativeToInput !== ".." &&
            !path.isAbsolute(reportRelativeToInput))) {
        throw new Error("config.outputReport must be outside the temporary input directory");
    }
    const jsonFiles = await findJsonFiles(inputDirectory);
    const discoveredExportFiles = [];
    const exportPlanFiles = [];
    const pageScanFiles = [];
    const ignoredFiles = [];
    let inventoryEntry = null;
    let pageListEntry = null;
    for (const filePath of jsonFiles) {
        const data = await readJson(filePath);
        if (isExportFile(data)) {
            discoveredExportFiles.push({ filePath, data });
        }
        else if (isExportPlanFile(data)) {
            exportPlanFiles.push({ filePath, data });
        }
        else if (isInventoryFile(data)) {
            if (inventoryEntry) {
                throw new Error("Multiple figma-variable-inventory files were found under the input directory");
            }
            inventoryEntry = { filePath, data };
        }
        else if (isPageListFile(data)) {
            if (pageListEntry) {
                throw new Error("Multiple figma-variable-page-list files were found under the input directory");
            }
            pageListEntry = { filePath, data };
        }
        else if (isPageScanFile(data)) {
            pageScanFiles.push({ filePath, data });
        }
        else {
            ignoredFiles.push(filePath);
        }
    }
    if (ignoredFiles.length > 0) {
        const preview = ignoredFiles
            .slice(0, 10)
            .map((file) => path.relative(process.cwd(), file))
            .join("\n");
        throw new Error(`Unexpected JSON file(s) were found in the temporary input directory:\n${preview}` +
            (ignoredFiles.length > 10 ? "\n..." : ""));
    }
    const exportFiles = options.localOnly
        ? discoveredExportFiles.filter(({ data }) => data.source.type === "local")
        : discoveredExportFiles;
    if (exportFiles.length === 0) {
        const scope = options.localOnly ? "local " : "";
        throw new Error(`No ${scope}figma-variable-export JSON files found under ${config.inputDirectory}`);
    }
    let payloadChecksumsVerified = 0;
    if (pageListEntry && verifyPayloadIntegrity(pageListEntry.data, path.relative(process.cwd(), pageListEntry.filePath), config.validation.requirePayloadChecksum)) {
        payloadChecksumsVerified += 1;
    }
    for (const { filePath, data } of pageScanFiles) {
        if (verifyPayloadIntegrity(data, path.relative(process.cwd(), filePath), config.validation.requirePayloadChecksum)) {
            payloadChecksumsVerified += 1;
        }
    }
    if (inventoryEntry && verifyPayloadIntegrity(inventoryEntry.data, path.relative(process.cwd(), inventoryEntry.filePath), config.validation.requirePayloadChecksum)) {
        payloadChecksumsVerified += 1;
    }
    for (const { filePath, data } of exportPlanFiles) {
        if (verifyPayloadIntegrity(data, path.relative(process.cwd(), filePath), config.validation.requirePayloadChecksum)) {
            payloadChecksumsVerified += 1;
        }
    }
    for (const { filePath, data } of exportFiles) {
        if (verifyPayloadIntegrity(data, path.relative(process.cwd(), filePath), config.validation.requirePayloadChecksum)) {
            payloadChecksumsVerified += 1;
        }
    }
    const inventory = inventoryEntry?.data ?? null;
    if (inventory && Buffer.byteLength(JSON.stringify(inventory), "utf8") >
        config.extraction.maxInventoryPayloadBytes) {
        throw new Error("Inventory payload exceeds config.extraction.maxInventoryPayloadBytes");
    }
    const pageCoverage = validatePageCoverage(pageListEntry, pageScanFiles, inventory);
    const exportPlan = validateExportPlan(config, exportPlanFiles, inventory, pageCoverage.directVariableIds, options.localOnly);
    const collections = mergeExports(exportFiles);
    const completeness = validateCompleteness(config, exportFiles, collections, inventory, exportPlan, pageCoverage.directVariableIds, options.localOnly);
    const { css, report } = generate(config, collections, exportFiles.map((entry) => entry.filePath));
    const fullReport = {
        ...report,
        warnings: [...(inventory?.warnings ?? []), ...report.warnings],
        completeness: {
            ...completeness,
            ...pageCoverage,
            directVariableIds: undefined,
            payloadChecksumsVerified,
            excludedLibraryExportFiles: discoveredExportFiles.length - exportFiles.length,
        },
        ignoredJsonFiles: ignoredFiles.map((file) => path.relative(process.cwd(), file)),
    };
    const reportText = `${JSON.stringify(fullReport, null, 2)}\n`;
    if (options.validateOnly) {
        console.log(`Validated ${exportFiles.length} export file(s) and ${payloadChecksumsVerified} payload checksum(s) ` +
            `for the supplied Figma file.`);
        return;
    }
    if (options.dryRun) {
        process.stdout.write(css);
        return;
    }
    await mkdir(path.dirname(outputCss), { recursive: true });
    await mkdir(path.dirname(outputReport), { recursive: true });
    await writeFile(outputCss, css, "utf8");
    await writeFile(outputReport, reportText, "utf8");
    const [writtenCss, writtenReport] = await Promise.all([
        readFile(outputCss, "utf8"),
        readFile(outputReport, "utf8"),
    ]);
    if (writtenCss !== css || writtenReport !== reportText) {
        throw new Error("Generated output verification failed. Temporary JSON was preserved.");
    }
    await removeTemporaryJson([...jsonFiles, outputReport]);
    const removedDirectories = await removeEmptyDirectories(inputDirectory);
    const reportSummary = {
        counts: fullReport.counts,
        selectors: fullReport.selectors,
        warnings: summarizeWarningsForStdout(fullReport.warnings),
        completeness: sanitizeCompletenessForStdout(fullReport.completeness),
    };
    console.log(`Generated ${report.counts.declarations} declarations from ${report.counts.variables} variables.\n` +
        `CSS: ${path.relative(process.cwd(), outputCss)}\n` +
        `Removed ${jsonFiles.length + 1} temporary JSON file(s).\n` +
        `Removed ${removedDirectories.length} empty temporary director${removedDirectories.length === 1 ? "y" : "ies"}.\n` +
        `Report summary:\n${JSON.stringify(reportSummary, null, 2)}`);
}
main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
