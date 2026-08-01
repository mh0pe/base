#!/usr/bin/env python3
"""
Hook: satellite-detection.py
Purpose: Scans the workspace recursively for PAUL state manifests,
         auto-registers new satellites, and syncs paul.toml (preferred) or
         legacy paul.json state to workspace.json and projects.json.
Triggers: SessionStart — runs once when Claude Code starts a session.
Output: <base-satellites> block if new satellites registered, silent otherwise.

Sync flow (PAUL state → workspace.json → projects.json):
  1. Discover paul.toml or legacy paul.json files across workspace
  2. Register new satellites (existing behavior)
  3. Sync PAUL state to workspace.json satellite entries
  4. Cross-check projects.json: update paul field on matching projects
  Respects satellite.sync: false as opt-out for steps 3-4.
"""

import sys
import json
import tomllib
from datetime import datetime
from pathlib import Path

# Workspace root — find .base/ relative to this hook's location
HOOK_DIR = Path(__file__).resolve().parent
import os as _bh_os
import sys as _bh_sys
_bh_pd = _bh_os.environ.get("CLAUDE_PROJECT_DIR")
if _bh_pd and _bh_pd.strip():
    WORKSPACE_ROOT = Path(_bh_pd).resolve()
else:
    WORKSPACE_ROOT = HOOK_DIR.parent.parent
    if not (WORKSPACE_ROOT / ".base").is_dir():
        _bh_sys.stderr.write("[base-hook] CLAUDE_PROJECT_DIR unset and no .base/ at %s; hook is a no-op. Set CLAUDE_PROJECT_DIR.\n" % WORKSPACE_ROOT)  # hooks/ -> .base/ -> workspace
BASE_DIR = WORKSPACE_ROOT / ".base"
MANIFEST_FILE = BASE_DIR / "workspace.json"
PROJECTS_FILE = BASE_DIR / "data" / "projects.json"


def has_hidden_component(path: Path, workspace_root: Path) -> bool:
    """
    Return True if any component of path (relative to workspace_root) starts with '.',
    excluding '.paul' itself (which is the expected target directory).
    """
    try:
        rel = path.relative_to(workspace_root)
    except ValueError:
        return True  # Can't relativize — skip it
    return any(part.startswith(".") and part != ".paul" for part in rel.parts)


def find_paul_state_files(workspace_root: Path) -> list[Path]:
    """
    Recursively scan workspace_root for PAUL state manifests.
    Prefer paul.toml when both formats exist in the same project.
    Skips any path that has a hidden directory component (starts with '.').
    """
    results = []
    try:
        for paul_dir in workspace_root.rglob(".paul"):
            if not paul_dir.is_dir():
                continue
            paul_toml = paul_dir / "paul.toml"
            paul_json = paul_dir / "paul.json"
            paul_state = paul_toml if paul_toml.is_file() else paul_json
            if paul_state.is_file() and not has_hidden_component(paul_state, workspace_root):
                results.append(paul_state)
    except (OSError, PermissionError):
        pass
    return sorted(results)


def read_paul_state(paul_state_path: Path) -> dict:
    """Read and normalize modern TOML or legacy JSON PAUL state."""
    if paul_state_path.suffix == ".toml":
        with open(paul_state_path, "rb") as handle:
            paul_data = tomllib.load(handle)
    else:
        with open(paul_state_path, "r", encoding="utf-8") as handle:
            paul_data = json.load(handle)

    if not isinstance(paul_data, dict):
        raise ValueError("PAUL state root must be a table/object")

    tables = {}
    for table_name in (
        "milestone",
        "stats",
        "phase",
        "timestamps",
        "loop",
        "handoff",
        "satellite",
        "project",
    ):
        table = paul_data.get(table_name, {})
        if not isinstance(table, dict):
            raise ValueError(f"PAUL state {table_name} must be a table/object")
        tables[table_name] = table

    groom = tables["satellite"].get("groom")
    name = paul_data.get("name")
    if name is not None and (not isinstance(name, str) or not name.strip()):
        raise ValueError("PAUL state name must be a non-empty string")
    if groom is not None and not isinstance(groom, bool):
        raise ValueError("PAUL state satellite.groom must be a boolean")
    for table_name, field_name in (
        ("milestone", "phases"),
        ("phase", "number"),
        ("phase", "total"),
        ("stats", "total_phases"),
    ):
        value = tables[table_name].get(field_name)
        if value is not None and (
            not isinstance(value, int) or isinstance(value, bool) or value < 0
        ):
            raise ValueError(
                f"PAUL state {table_name}.{field_name} must be a non-negative integer"
            )

    milestone = tables["milestone"]
    stats = tables["stats"]
    phase = dict(tables["phase"])
    timestamps = dict(tables["timestamps"])
    if phase.get("total") is None:
        # milestone.phases is the current milestone denominator used by BASE.
        # stats.total_phases is lifetime completed work across all milestones.
        phase["total"] = milestone.get("phases")
    if timestamps.get("updated_at") is None:
        last_activity = stats.get("last_activity")
        if hasattr(last_activity, "isoformat"):
            last_activity = last_activity.isoformat()
        timestamps["updated_at"] = last_activity

    return {**paul_data, "phase": phase, "timestamps": timestamps}


def should_sync(paul_data: dict) -> bool:
    """Check if this satellite opts into sync. Default: True."""
    satellite = paul_data.get("satellite", {})
    return satellite.get("sync", True)


def sync_to_workspace(satellites: dict, paul_data: dict, name: str) -> bool:
    """Sync PAUL state to workspace.json satellite entry. Returns True if changed."""
    if name not in satellites:
        return False

    sat = satellites[name]
    changed = False

    phase = paul_data.get("phase", {})
    loop = paul_data.get("loop", {})
    handoff = paul_data.get("handoff", {})
    satellite = paul_data.get("satellite", {})

    updates = {}
    for source, source_key, target_key in (
        (phase, "name", "phase_name"),
        (phase, "number", "phase_number"),
        (phase, "status", "phase_status"),
        (loop, "position", "loop_position"),
        (handoff, "present", "handoff"),
        (paul_data, "last_plan_completed_at", "last_plan_completed_at"),
        (paul_data, "next_action", "next_action"),
        (satellite, "groom", "groom_check"),
    ):
        if source_key in source:
            updates[target_key] = source[source_key]

    for key, value in updates.items():
        if sat.get(key) != value:
            sat[key] = value
            changed = True

    return changed


def build_paul_field(paul_data: dict, name: str, sat_path: str) -> dict:
    """Build a standardized paul field from normalized PAUL state."""
    phase = paul_data.get("phase", {})
    loop = paul_data.get("loop", {})
    handoff = paul_data.get("handoff", {})
    milestone = paul_data.get("milestone", {})
    timestamps = paul_data.get("timestamps", {})

    if "phases" in milestone:
        # PAUL phase numbers are lifetime/global, while milestone.phases is
        # scoped to the current milestone. Only report a numerator when the
        # milestone status makes it unambiguous.
        if milestone.get("status") == "complete":
            completed = milestone["phases"]
        elif milestone.get("status") == "not_started" or milestone["phases"] == 0:
            completed = 0
        else:
            completed = None
    else:
        # Legacy paul.json stored no current-milestone denominator. Retain its
        # historical phase-number behavior for backwards compatibility.
        completed = (
            phase.get("number", 1)
            if phase.get("status") == "complete"
            else max(0, (phase.get("number", 1) or 1) - 1)
        )

    paul_field = {
        "is_paul_project": True,
        "satellite_name": name,
        "location": sat_path.rstrip("/") + "/",
        "milestone": milestone.get("name"),
        "phase": phase.get("name"),
        "phase_name": phase.get("name"),
        "loop_position": loop.get("position"),
        "last_update": timestamps.get("updated_at"),
        "completed_phases": completed,
        "total_phases": phase.get("total"),
    }

    # These fields exist only in legacy paul.json. Do not erase a previously
    # synced value merely because modern paul.toml has no equivalent field.
    if "present" in handoff:
        paul_field["handoff"] = handoff["present"]
    if "path" in handoff:
        paul_field["handoff_path"] = handoff["path"]
    if "last_plan_completed_at" in paul_data:
        paul_field["last_plan_completed_at"] = paul_data["last_plan_completed_at"]

    return paul_field


def find_project_by_path(items: list, sat_path: str):
    """Find project by location path (flexible trailing slash matching)."""
    normalized = sat_path.rstrip("/")
    for item in items:
        loc = (item.get("location") or "").rstrip("/")
        if loc == normalized:
            return item
    return None


def sync_to_projects(paul_data: dict, name: str, sat_path: str, projects_data: dict) -> str:
    """Sync normalized PAUL state to matching project in projects.json.
    Returns: 'updated', 'created', or 'none'."""
    items = projects_data.get("items", [])

    # Match by satellite_name first, then by path
    project = None
    for item in items:
        paul_field = item.get("paul")
        if paul_field and paul_field.get("satellite_name") == name:
            project = item
            break
    if not project:
        project = find_project_by_path(items, sat_path)

    paul_field = build_paul_field(paul_data, name, sat_path)

    if project:
        # Update existing — merge paul field
        if not project.get("paul"):
            project["paul"] = {}
        project["paul"].update(paul_field)
        project["updated_at"] = datetime.now().isoformat()
        return "updated"

    # Auto-create project entry
    max_num = 0
    for item in items:
        match = (item.get("id") or "").replace("PRJ-", "")
        try:
            num = int(match)
            if num > max_num:
                max_num = num
        except ValueError:
            pass

    new_id = f"PRJ-{max_num + 1:03d}"
    title = paul_data.get("project", {}).get("title") or name
    now = datetime.now().isoformat()

    items.append({
        "id": new_id,
        "title": title,
        "type": "project",
        "parent_id": None,
        "status": "in_progress",
        "priority": "medium",
        "category": "internal",
        "assignees": [],
        "start_date": None,
        "due_date": None,
        "created_at": now,
        "updated_at": now,
        "location": sat_path.rstrip("/") + "/",
        "blocked_by": None,
        "next": None,
        "notes": [],
        "tags": [],
        "paul": paul_field,
        "relations": [],
        "description": None,
    })
    return "created"


def main():
    # Skip if BASE is not installed
    if not BASE_DIR.exists() or not MANIFEST_FILE.exists():
        sys.exit(0)

    try:
        with open(MANIFEST_FILE, "r") as f:
            manifest = json.load(f)
    except (json.JSONDecodeError, OSError):
        sys.exit(0)

    satellites = manifest.get("satellites", {})
    new_registrations = []
    workspace_changed = False
    projects_changed = False

    # Load projects.json for cross-check (if it exists)
    projects_data = None
    if PROJECTS_FILE.exists():
        try:
            with open(PROJECTS_FILE, "r") as f:
                projects_data = json.load(f)
        except (json.JSONDecodeError, OSError):
            projects_data = None

    paul_files = find_paul_state_files(WORKSPACE_ROOT)

    # Collect paul data for sync pass
    paul_registry = {}  # name → paul_data

    for paul_state_path in paul_files:
        try:
            paul_data = read_paul_state(paul_state_path)
        except (json.JSONDecodeError, tomllib.TOMLDecodeError, OSError, TypeError, ValueError):
            continue  # Malformed or unreadable — skip silently

        name = paul_data.get("name")
        if not name:
            continue  # No name field — skip

        paul_registry[name] = paul_data

        # Read normalized last_activity from the PAUL state (if present)
        last_activity = paul_data.get("timestamps", {}).get("updated_at")

        if name in satellites:
            # Already registered — refresh last_activity if available
            if last_activity and satellites[name].get("last_activity") != last_activity:
                satellites[name]["last_activity"] = last_activity
                workspace_changed = True
            continue

        # New satellite — derive relative path
        project_dir = paul_state_path.parent.parent
        try:
            rel_path = str(project_dir.relative_to(WORKSPACE_ROOT))
        except ValueError:
            continue  # Can't relativize — skip

        # Build registration entry
        entry = {
            "path": rel_path,
            "engine": "paul",
            "state": f"{rel_path}/.paul/STATE.md",
            "registered": datetime.now().strftime("%Y-%m-%d"),
            "groom_check": paul_data.get("satellite", {}).get("groom", True),
        }
        if last_activity:
            entry["last_activity"] = last_activity

        satellites[name] = entry
        new_registrations.append(name)
        workspace_changed = True

    # --- Sync pass: PAUL state → workspace.json + projects.json ---
    for name, paul_data in paul_registry.items():
        if not should_sync(paul_data):
            continue  # Opt-out — skip sync

        # Sync to workspace.json
        if sync_to_workspace(satellites, paul_data, name):
            workspace_changed = True

        # Sync to projects.json
        if projects_data:
            sat_path = satellites.get(name, {}).get("path", "")
            result = sync_to_projects(paul_data, name, sat_path, projects_data)
            if result in ("updated", "created"):
                projects_changed = True

    # Write workspace.json if changed
    if workspace_changed:
        try:
            manifest["satellites"] = satellites
            with open(MANIFEST_FILE, "w") as f:
                json.dump(manifest, f, indent=2)
                f.write("\n")
        except OSError:
            pass  # Write failed — silent

    # Write projects.json if changed
    if projects_changed and projects_data:
        try:
            projects_data["last_modified"] = datetime.now().isoformat()
            with open(PROJECTS_FILE, "w") as f:
                json.dump(projects_data, f, indent=2)
                f.write("\n")
        except OSError:
            pass  # Write failed — silent

    # Output only for new registrations
    if new_registrations:
        names_str = ", ".join(new_registrations)
        n = len(new_registrations)
        print(f"<base-satellites>\nAuto-registered {n} new satellite(s): {names_str}\n</base-satellites>")

    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(0)
