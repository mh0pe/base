# Satellite Registration Framework

## What Are Satellites

Satellites are projects that live in their own git repos inside the workspace (e.g., `apps/*`). They run their own Claude Code sessions independently. BASE needs visibility into them without owning them.

## Registration Flow

### Automatic (via PAUL init)
When `/paul:init` runs in a subdirectory:
1. Check if parent directory has `.base/workspace.json`
2. If yes, write registration entry: project name, path, engine type, state file path, date
3. Report: "Registered with BASE workspace: {workspace-name}"

### Automatic (via BASE scaffold)
When `/base:scaffold` runs:
1. Scan configured satellite directories (default: `apps/`)
2. Detect existing `.paul/` directories
3. Auto-register discovered projects
4. Report: "Found {N} satellite projects. Registered."

### Automatic (via BASE groom)
During groom:
1. Read registered satellites from workspace.json
2. Check each path exists (clean up broken registrations)
3. Scan satellite directories for unregistered projects with `.paul/`
4. Flag: "Found unregistered project: {name}. Register?"

## Health Checks

During `/base:pulse` and `/base:groom`, for each satellite:
1. Read the state file (e.g., `.paul/STATE.md`)
2. Check last modification date
3. Extract current phase/milestone if parseable
4. Report health: active, stale, or unknown

BASE never modifies satellite state. It only reads and reports. PAUL (or whatever engine) manages the project. BASE manages the workspace those projects live in.

## Deregistration

Satellites are deregistered when:
- The project directory no longer exists (auto-cleaned during groom)
- The user explicitly removes it during audit
- The project is archived (moved to `_archive/` or similar)
