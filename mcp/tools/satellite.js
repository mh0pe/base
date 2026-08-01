/**
 * BASE Satellite Sync — Real-time PAUL project state sync
 * Reads paul.toml (preferred) or legacy paul.json from a satellite, then syncs
 * to workspace.json + projects.json.
 * Called by PAUL at end of each loop phase (plan, apply, unify, handoff)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import TOML from '@iarna/toml';
import { validateSurface } from './validate.js';

function debugLog(...args) {
    console.error('[BASE:satellite]', new Date().toISOString(), ...args);
}

// ============================================================
// HELPERS
// ============================================================

function readJson(filepath) {
    if (!existsSync(filepath)) return null;
    try {
        return JSON.parse(readFileSync(filepath, 'utf-8'));
    } catch (e) {
        return null;
    }
}

function readPaulState(filepath) {
    const source = readFileSync(filepath, 'utf-8');
    try {
        return filepath.endsWith('.toml') ? TOML.parse(source) : JSON.parse(source);
    } catch (error) {
        throw new Error(`Cannot parse PAUL state at ${filepath}: ${error.message}`);
    }
}

function paulTable(paulData, name) {
    const value = paulData[name] === undefined ? {} : paulData[name];
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`PAUL state ${name} must be a table/object`);
    }
    return value;
}

function normalizePaulData(paulData) {
    if (paulData === null || typeof paulData !== 'object' || Array.isArray(paulData)) {
        throw new Error('PAUL state root must be a table/object');
    }

    const milestone = paulTable(paulData, 'milestone');
    const stats = paulTable(paulData, 'stats');
    const phase = { ...paulTable(paulData, 'phase') };
    const timestamps = { ...paulTable(paulData, 'timestamps') };
    for (const name of ['loop', 'handoff', 'satellite', 'project']) {
        paulTable(paulData, name);
    }

    const satellite = paulTable(paulData, 'satellite');
    if (Object.hasOwn(paulData, 'name')
        && (typeof paulData.name !== 'string' || paulData.name.trim() === '')) {
        throw new Error('PAUL state name must be a non-empty string');
    }
    if (Object.hasOwn(satellite, 'groom') && typeof satellite.groom !== 'boolean') {
        throw new Error('PAUL state satellite.groom must be a boolean');
    }
    for (const [tableName, table, fieldName] of [
        ['milestone', milestone, 'phases'],
        ['phase', phase, 'number'],
        ['phase', phase, 'total'],
        ['stats', stats, 'total_phases'],
    ]) {
        const value = table[fieldName];
        if (value !== undefined
            && (!Number.isInteger(value) || value < 0)) {
            throw new Error(`PAUL state ${tableName}.${fieldName} must be a non-negative integer`);
        }
    }

    // paul.toml stores these values under [stats]; legacy paul.json stores
    // them under phase/timestamps. Normalize both formats before syncing.
    // milestone.phases is the denominator for the current milestone. The
    // similarly named stats.total_phases is a lifetime completed counter and
    // must not be displayed as the current milestone's total.
    phase.total ??= milestone.phases ?? null;
    timestamps.updated_at ??= stats.last_activity ?? null;

    return { ...paulData, phase, timestamps };
}

function writeJson(filepath, data) {
    writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function formatTimestamp() {
    return new Date().toISOString();
}

function buildPaulField(paulData, satelliteName, satellitePath) {
    const phase = paulData.phase || {};
    const loop = paulData.loop || {};
    const handoff = paulData.handoff || {};
    const milestone = paulData.milestone || {};
    const timestamps = paulData.timestamps || {};

    let completedPhases;
    if (Object.hasOwn(milestone, 'phases')) {
        // PAUL phase numbers are lifetime/global, while milestone.phases is
        // scoped to the current milestone. Only report a numerator when the
        // milestone status makes it unambiguous.
        if (milestone.status === 'complete') completedPhases = milestone.phases;
        else if (milestone.status === 'not_started' || milestone.phases === 0) completedPhases = 0;
        else completedPhases = null;
    } else {
        // Legacy paul.json stored no current-milestone denominator. Retain its
        // historical phase-number behavior for backwards compatibility.
        completedPhases = phase.status === 'complete'
            ? phase.number
            : Math.max(0, (phase.number || 1) - 1);
    }

    const paulField = {
        is_paul_project: true,
        satellite_name: satelliteName,
        location: satellitePath + '/',
        milestone: milestone.name || null,
        phase: phase.name || null,
        phase_name: phase.name || null,
        loop_position: loop.position || 'IDLE',
        last_update: timestamps.updated_at || formatTimestamp(),
        completed_phases: completedPhases,
        total_phases: phase.total ?? null,
    };

    // These fields exist only in legacy paul.json. Do not erase a previously
    // synced value merely because modern paul.toml has no equivalent field.
    if (Object.hasOwn(handoff, 'present')) paulField.handoff = handoff.present;
    if (Object.hasOwn(handoff, 'path')) paulField.handoff_path = handoff.path;
    if (Object.hasOwn(paulData, 'last_plan_completed_at')) {
        paulField.last_plan_completed_at = paulData.last_plan_completed_at;
    }

    return paulField;
}

function findProjectByPath(items, satellitePath) {
    const pathVariants = [
        satellitePath,
        satellitePath + '/',
        satellitePath.replace(/\/$/, ''),
    ];
    return items.find(item => {
        const loc = (item.location || '').replace(/\/$/, '');
        return pathVariants.some(v => v.replace(/\/$/, '') === loc);
    });
}

function findProjectBySatelliteName(items, name) {
    return items.find(item =>
        item.paul && item.paul.satellite_name === name
    );
}

// ============================================================
// SYNC LOGIC
// ============================================================

function syncSatellite(paulStatePath, workspacePath) {
    const paulData = normalizePaulData(readPaulState(paulStatePath));

    const name = paulData.name;
    if (!name) throw new Error('PAUL state has no name field');

    // Derive paths
    const projectDir = join(paulStatePath, '..', '..');
    const satellitePath = relative(workspacePath, projectDir) || '.';
    const phase = paulData.phase || {};
    const loop = paulData.loop || {};
    const handoff = paulData.handoff || {};
    const satellite = paulData.satellite || {};
    const timestamps = paulData.timestamps || {};

    const result = { satellite: name, workspace_synced: false, project_synced: false, project_created: false };

    // --- Sync workspace.json ---
    const manifestPath = join(workspacePath, '.base', 'workspace.json');
    const manifest = readJson(manifestPath);
    if (manifest) {
        if (!manifest.satellites) manifest.satellites = {};
        const sat = manifest.satellites[name];

        if (sat) {
            // Update existing satellite
            sat.last_activity = timestamps.updated_at || formatTimestamp();
            if (Object.hasOwn(phase, 'name')) sat.phase_name = phase.name;
            if (Object.hasOwn(phase, 'number')) sat.phase_number = phase.number;
            if (Object.hasOwn(phase, 'status')) sat.phase_status = phase.status;
            if (Object.hasOwn(loop, 'position')) sat.loop_position = loop.position;
            if (Object.hasOwn(handoff, 'present')) sat.handoff = handoff.present;
            if (Object.hasOwn(paulData, 'last_plan_completed_at')) {
                sat.last_plan_completed_at = paulData.last_plan_completed_at;
            }
            if (Object.hasOwn(satellite, 'groom')) sat.groom_check = satellite.groom;
            result.workspace_synced = true;
        } else {
            // New satellite — register
            manifest.satellites[name] = {
                path: satellitePath,
                engine: 'paul',
                state: satellitePath + '/.paul/STATE.md',
                registered: new Date().toISOString().split('T')[0],
                groom_check: satellite.groom ?? true,
                last_activity: timestamps.updated_at || formatTimestamp(),
                phase_name: phase.name,
                phase_number: phase.number,
                phase_status: phase.status,
                loop_position: loop.position,
            };
            if (Object.hasOwn(handoff, 'present')) {
                manifest.satellites[name].handoff = handoff.present;
            }
            if (Object.hasOwn(paulData, 'last_plan_completed_at')) {
                manifest.satellites[name].last_plan_completed_at = paulData.last_plan_completed_at;
            }
            result.workspace_synced = true;
        }

        writeJson(manifestPath, manifest);
    }

    // --- Sync projects.json ---
    const projectsPath = join(workspacePath, '.base', 'data', 'projects.json');
    const projectsData = readJson(projectsPath);
    if (projectsData) {
        let project = findProjectBySatelliteName(projectsData.items, name)
            || findProjectByPath(projectsData.items, satellitePath);

        const paulField = buildPaulField(paulData, name, satellitePath);

        if (project) {
            // Update existing — merge paul field, preserve user-set fields
            if (!project.paul) project.paul = {};
            Object.assign(project.paul, paulField);
            project.updated_at = formatTimestamp();
            result.project_synced = true;
        } else {
            // Auto-create project entry
            const maxNum = projectsData.items
                .filter(i => (i.id || '').startsWith('PRJ-'))
                .reduce((max, i) => {
                    const n = parseInt((i.id || '').replace('PRJ-', ''), 10);
                    return n > max ? n : max;
                }, 0);

            const newId = `PRJ-${String(maxNum + 1).padStart(3, '0')}`;
            const title = paulData.project?.title || name;
            const now = formatTimestamp();

            projectsData.items.push({
                id: newId,
                title,
                type: 'project',
                parent_id: null,
                status: 'in_progress',
                priority: 'medium',
                category: 'internal',
                assignees: [],
                start_date: null,
                due_date: null,
                created_at: now,
                updated_at: now,
                location: satellitePath + '/',
                blocked_by: null,
                next: null,
                notes: [],
                tags: [],
                paul: paulField,
                relations: [],
                description: null,
            });
            result.project_created = true;
            result.project_id = newId;
        }

        projectsData.last_modified = formatTimestamp();
        validateSurface('projects', projectsData);
        writeJson(projectsPath, projectsData);
    }

    debugLog(`Synced satellite: ${name} (ws:${result.workspace_synced}, prj:${result.project_synced}, new:${result.project_created})`);
    return result;
}

// ============================================================
// TOOL DEFINITIONS
// ============================================================

export const TOOLS = [
    {
        name: "base_sync_satellite",
        description: "Sync a PAUL satellite's state to workspace.json and projects.json. Prefers paul.toml and falls back to legacy paul.json, updates the satellite entry and matching project, and creates a project entry if none exists. Call after plan/apply/unify/handoff.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Workspace-relative path to the PAUL project (e.g., 'apps/my-app')" },
            },
            required: ["path"]
        }
    }
];

// ============================================================
// HANDLER DISPATCH
// ============================================================

export function handleTool(name, args, workspacePath) {
    switch (name) {
        case 'base_sync_satellite': {
            const { path: projectPath } = args;
            if (!projectPath) throw new Error('Missing required parameter: path');

            const paulDir = join(workspacePath, projectPath, '.paul');
            const paulTomlPath = join(paulDir, 'paul.toml');
            const paulJsonPath = join(paulDir, 'paul.json');
            const paulStatePath = existsSync(paulTomlPath) ? paulTomlPath : paulJsonPath;

            if (!existsSync(paulStatePath)) {
                throw new Error(`No paul.toml or paul.json found at ${projectPath}/.paul/`);
            }

            return syncSatellite(paulStatePath, workspacePath);
        }
        default:
            return null;
    }
}
