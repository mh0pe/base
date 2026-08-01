/**
 * BASE State — Read/update tools for state.json
 * Workspace health, drift tracking, groom scheduling
 */

import {
    chmodSync,
    existsSync,
    readFileSync,
    renameSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from 'fs';
import { join } from 'path';
import { validateSurface } from './validate.js';

function debugLog(...args) {
    console.error('[BASE:state]', new Date().toISOString(), ...args);
}

// ============================================================
// HELPERS
// ============================================================

function getStatePath(workspacePath) {
    return join(workspacePath, '.base', 'data', 'state.json');
}

function readRequiredJson(filepath, label) {
    if (!existsSync(filepath)) {
        throw new Error(`${label} not found at ${filepath}`);
    }
    try {
        const value = JSON.parse(readFileSync(filepath, 'utf-8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error('root value must be an object');
        }
        return value;
    } catch (error) {
        throw new Error(`Cannot parse ${label} at ${filepath}: ${error.message}`);
    }
}

function replaceJsonFiles(entries) {
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const staged = [];
    const backups = [];

    const removeIfPresent = (filepath) => {
        if (existsSync(filepath)) unlinkSync(filepath);
    };

    try {
        // Prepare every replacement beside its destination before moving any
        // live file. A permission or disk error therefore leaves both sources
        // untouched instead of recording hygiene in only one BASE surface.
        for (const [index, entry] of entries.entries()) {
            const tempPath = `${entry.filepath}.${token}-${index}.tmp`;
            const mode = statSync(entry.filepath).mode & 0o777;
            writeFileSync(tempPath, entry.contents, {
                encoding: 'utf-8',
                flag: 'wx',
                mode,
            });
            chmodSync(tempPath, mode);
            staged.push({ ...entry, tempPath });
        }

        // Retain the originals until every staged replacement is ready. If a
        // later rename fails, the catch block restores the complete pair.
        for (const [index, entry] of staged.entries()) {
            const backupPath = `${entry.filepath}.${token}-${index}.bak`;
            renameSync(entry.filepath, backupPath);
            backups.push({ filepath: entry.filepath, backupPath });
        }

        for (const entry of staged) {
            renameSync(entry.tempPath, entry.filepath);
        }
    } catch (error) {
        for (const entry of [...backups].reverse()) {
            try {
                removeIfPresent(entry.filepath);
                if (existsSync(entry.backupPath)) {
                    renameSync(entry.backupPath, entry.filepath);
                }
            } catch {
                // Keep the original error; a surviving .bak file remains
                // recoverable if an external filesystem fault blocks rollback.
            }
        }
        for (const entry of staged) {
            try {
                removeIfPresent(entry.tempPath);
            } catch {
                // Best-effort cleanup only; never hide the write failure.
            }
        }
        throw error;
    }

    // Backups are no longer needed after both replacements land. Cleanup is
    // best effort so a harmless unlink failure cannot roll back valid writes.
    for (const entry of backups) {
        try {
            removeIfPresent(entry.backupPath);
        } catch {
            // A leftover backup is safer than reporting a false write failure.
        }
    }
}

function readState(workspacePath) {
    const filepath = getStatePath(workspacePath);
    if (!existsSync(filepath)) {
        return { version: 1, workspace: '', last_modified: null, groom: {}, drift: { score: 0, indicators: {} }, areas: {}, satellites: {} };
    }
    try {
        return JSON.parse(readFileSync(filepath, 'utf-8'));
    } catch (error) {
        debugLog('Error reading state.json:', error.message);
        return { version: 1, workspace: '', last_modified: null, groom: {}, drift: { score: 0, indicators: {} }, areas: {}, satellites: {} };
    }
}

function writeState(workspacePath, data) {
    const filepath = getStatePath(workspacePath);
    data.last_modified = new Date().toISOString();
    validateSurface('state', data);
    writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function validatedDate(date) {
    const value = date ?? todayStr();
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)
        || Number.isNaN(parsed.getTime())
        || parsed.toISOString().split('T')[0] !== value) {
        throw new Error('date must be a valid YYYY-MM-DD calendar date');
    }
    return value;
}

// ============================================================
// TOOL DEFINITIONS
// ============================================================

export const TOOLS = [
    {
        name: "base_get_state",
        description: "Read full workspace state (groom, drift, areas, satellites, carl_hygiene). Returns entire state.json.",
        inputSchema: {
            type: "object",
            properties: {},
            required: []
        }
    },
    {
        name: "base_update_drift",
        description: "Update drift indicators and recalculate composite score. Pass indicator key-value pairs to merge.",
        inputSchema: {
            type: "object",
            properties: {
                indicators: {
                    type: "object",
                    description: "Drift indicator updates (e.g., { active_age_days: 2, backlog_past_review: 3 })"
                }
            },
            required: ["indicators"]
        }
    },
    {
        name: "base_record_groom",
        description: "Record a groom event. Sets last_groom to today and advances next_groom_due based on cadence.",
        inputSchema: {
            type: "object",
            properties: {},
            required: []
        }
    },
    {
        name: "base_record_carl_hygiene",
        description: "Record a completed CARL hygiene review in workspace.json and state.json. Updates only the hygiene last-run date and operator-provided summary while preserving all other state.",
        inputSchema: {
            type: "object",
            properties: {
                summary: {
                    type: "string",
                    minLength: 1,
                    maxLength: 4000,
                    description: "Concise evidence summary of proposals, rules, and decisions reviewed"
                },
                date: {
                    type: "string",
                    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                    description: "Optional completion date in YYYY-MM-DD form; defaults to today"
                }
            },
            required: ["summary"]
        }
    },
    {
        name: "base_update_area",
        description: "Update a specific workspace area's fields (status, last_touched, groom_due, etc.).",
        inputSchema: {
            type: "object",
            properties: {
                area: { type: "string", description: "Area slug (key in state.json areas object)" },
                data: { type: "object", description: "Fields to merge into the area object" }
            },
            required: ["area", "data"]
        }
    }
];

// ============================================================
// TOOL HANDLERS
// ============================================================

function handleGetState(workspacePath) {
    debugLog('Reading state');
    return readState(workspacePath);
}

function handleUpdateDrift(args, workspacePath) {
    const { indicators } = args;
    if (!indicators) throw new Error('Missing required parameter: indicators');

    debugLog('Updating drift indicators');
    const data = readState(workspacePath);

    if (!data.drift) data.drift = { score: 0, indicators: {} };
    if (!data.drift.indicators) data.drift.indicators = {};

    // Merge indicators
    data.drift.indicators = { ...data.drift.indicators, ...indicators };

    // Recalculate score as sum of all indicator values
    data.drift.score = Object.values(data.drift.indicators)
        .reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);

    writeState(workspacePath, data);

    return {
        score: data.drift.score,
        indicators: data.drift.indicators
    };
}

function handleRecordGroom(workspacePath) {
    debugLog('Recording groom event');
    const data = readState(workspacePath);

    if (!data.groom) data.groom = { cadence: 'weekly', day: 'friday' };

    const today = todayStr();
    data.groom.last_groom = today;

    // Calculate next due based on cadence
    const cadenceDays = {
        daily: 1,
        weekly: 7,
        'bi-weekly': 14,
        monthly: 30
    };
    const days = cadenceDays[data.groom.cadence] || 7;
    data.groom.next_groom_due = addDays(today, days);

    writeState(workspacePath, data);

    return {
        last_groom: data.groom.last_groom,
        next_groom_due: data.groom.next_groom_due,
        cadence: data.groom.cadence
    };
}

function handleRecordCarlHygiene(args = {}, workspacePath) {
    const summary = typeof args.summary === 'string' ? args.summary.trim() : '';
    if (!summary) throw new Error('Missing required parameter: summary');
    if (summary.length > 4000) throw new Error('summary must be 4000 characters or fewer');

    const runDate = validatedDate(args.date);
    const statePath = getStatePath(workspacePath);
    const manifestPath = join(workspacePath, '.base', 'workspace.json');

    // Read and validate both files before writing either one so malformed or
    // incomplete workspace state cannot produce a one-sided hygiene record.
    const data = readRequiredJson(statePath, 'state.json');
    const manifest = readRequiredJson(manifestPath, 'workspace.json');
    if (!manifest.carl_hygiene
        || typeof manifest.carl_hygiene !== 'object'
        || Array.isArray(manifest.carl_hygiene)) {
        throw new Error('workspace.json has no carl_hygiene configuration');
    }

    if (data.groom !== undefined
        && (typeof data.groom !== 'object' || data.groom === null || Array.isArray(data.groom))) {
        throw new Error('state.json groom field must be an object');
    }
    if (data.carl_hygiene !== undefined
        && (typeof data.carl_hygiene !== 'object'
            || data.carl_hygiene === null
            || Array.isArray(data.carl_hygiene))) {
        throw new Error('state.json carl_hygiene field must be an object');
    }

    if (!data.groom) data.groom = {};
    data.groom.last_carl_hygiene = runDate;
    data.groom.carl_hygiene_note = summary;

    // state.json powers pulse hooks while workspace.json owns the operator
    // configuration. Keep their last-run marker aligned without replacing
    // either file's other fields.
    data.carl_hygiene = {
        ...(data.carl_hygiene || {}),
        ...manifest.carl_hygiene,
        last_run: runDate,
    };
    manifest.carl_hygiene.last_run = runDate;

    data.last_modified = new Date().toISOString();
    validateSurface('state', data);
    replaceJsonFiles([
        { filepath: statePath, contents: JSON.stringify(data, null, 2) },
        { filepath: manifestPath, contents: JSON.stringify(manifest, null, 2) + '\n' },
    ]);
    debugLog('Recorded CARL hygiene:', runDate);

    return { last_run: runDate, summary };
}

function handleUpdateArea(args, workspacePath) {
    const { area, data: updateData } = args;
    if (!area) throw new Error('Missing required parameter: area');
    if (!updateData) throw new Error('Missing required parameter: data');

    debugLog('Updating area:', area);
    const data = readState(workspacePath);

    if (!data.areas) data.areas = {};
    if (!data.areas[area]) {
        throw new Error(`Area "${area}" not found. Available: ${Object.keys(data.areas).join(', ') || 'none'}`);
    }

    data.areas[area] = { ...data.areas[area], ...updateData };
    writeState(workspacePath, data);

    return data.areas[area];
}

// ============================================================
// HANDLER DISPATCH
// ============================================================

export function handleTool(name, args, workspacePath) {
    switch (name) {
        case 'base_get_state':
            return handleGetState(workspacePath);
        case 'base_update_drift':
            return handleUpdateDrift(args, workspacePath);
        case 'base_record_groom':
            return handleRecordGroom(workspacePath);
        case 'base_record_carl_hygiene':
            return handleRecordCarlHygiene(args, workspacePath);
        case 'base_update_area':
            return handleUpdateArea(args, workspacePath);
        default:
            return null;
    }
}
