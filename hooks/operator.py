#!/usr/bin/env python3
"""
BASE Hook: operator.py
Source: .base/operator.json
Output: <operator> compact identity summary for alignment context
Controlled by: hook_active field in operator.json (true/false)
"""

import json
from pathlib import Path

HOOK_DIR = Path(__file__).resolve().parent
import os as _bh_os
import sys as _bh_sys
_bh_pd = _bh_os.environ.get("CLAUDE_PROJECT_DIR")
if _bh_pd and _bh_pd.strip():
    WORKSPACE_ROOT = Path(_bh_pd).resolve()
else:
    WORKSPACE_ROOT = HOOK_DIR.parent.parent
    if not (WORKSPACE_ROOT / ".base").is_dir():
        _bh_sys.stderr.write("[base-hook] CLAUDE_PROJECT_DIR unset and no .base/ at %s; hook is a no-op. Set CLAUDE_PROJECT_DIR.\n" % WORKSPACE_ROOT)
DATA_FILE = WORKSPACE_ROOT / ".base" / "operator.json"


def main():
    if not DATA_FILE.exists():
        return

    try:
        data = json.loads(DATA_FILE.read_text())
    except (json.JSONDecodeError, IOError):
        return

    # Check activation flag
    if not data.get("hook_active", False):
        return

    # Extract high-signal fields
    north_star = data.get("north_star", {}).get("metric", "Not set")
    timeframe = data.get("north_star", {}).get("timeframe", "")
    deep_why = data.get("deep_why", {}).get("statement", "Not set")
    values = [v.get("value", "") for v in data.get("key_values", {}).get("values", [])]
    vision = data.get("surface_vision", {}).get("summary", "Not set")
    pitch = data.get("elevator_pitch", {}).get("pitch", "Not set")

    values_str = ", ".join(values) if values else "Not set"
    star_str = f"{north_star} ({timeframe})" if timeframe else north_star

    output = f"""<operator>
North Star: {star_str}
Deep Why: {deep_why}
Values: {values_str}
Vision: {vision}
Pitch: {pitch}
</operator>"""

    print(output)


if __name__ == "__main__":
    main()
