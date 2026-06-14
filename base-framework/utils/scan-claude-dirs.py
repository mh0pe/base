#!/usr/bin/env python3
"""
scan-claude-dirs.py — Exhaustive .claude/ directory scanner for BASE audit-claude workflow.

Produces a structured JSON dataset of every .claude/ directory in a workspace,
including baselines (global ~/.claude/, workspace root .claude/, MCP registry).
Every file gets an MD5 hash. No judgment, no classification — pure data collection.

Usage:
    python3 scan-claude-dirs.py [--workspace <path>] [--global-config <path>] [--output <path>]

Defaults:
    --workspace     Current working directory
    --global-config ~/.claude
    --output        .base/audits/data-sets/claude-scan-{date}.json

The audit-claude workflow reads this JSON and performs classification/planning
against a complete, verified dataset instead of ad-hoc bash commands.
"""

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone

# Directories to skip during recursive scan
SKIP_PATTERNS = {
    'node_modules', '_archive', '.git', 'vendor', 'dist', 'build',
    '__pycache__', '.venv', 'venv', '.tox', '.mypy_cache', '.pytest_cache'
}


def md5_file(filepath):
    """Compute MD5 hash of a file."""
    try:
        h = hashlib.md5()
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                h.update(chunk)
        return h.hexdigest()
    except (OSError, PermissionError):
        return None


def file_line_count(filepath):
    """Count lines in a text file."""
    try:
        with open(filepath, 'r', errors='replace') as f:
            return sum(1 for _ in f)
    except (OSError, PermissionError):
        return None


def last_modified(filepath):
    """Get last modification time as ISO string."""
    try:
        ts = os.path.getmtime(filepath)
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    except OSError:
        return None


def dir_last_modified(dirpath):
    """Get the most recent modification time of any file in a directory tree."""
    latest = 0
    try:
        for root, dirs, files in os.walk(dirpath):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    mt = os.path.getmtime(fp)
                    if mt > latest:
                        latest = mt
                except OSError:
                    pass
    except OSError:
        pass
    if latest == 0:
        return None
    return datetime.fromtimestamp(latest, tz=timezone.utc).isoformat()


def scan_files_in_dir(dirpath, relative_to=None):
    """List all files in a directory (non-recursive) with metadata."""
    results = []
    if not os.path.isdir(dirpath):
        return results
    try:
        for name in sorted(os.listdir(dirpath)):
            fp = os.path.join(dirpath, name)
            if os.path.isfile(fp):
                entry = {
                    'name': name,
                    'md5': md5_file(fp),
                    'lines': file_line_count(fp),
                    'size_bytes': os.path.getsize(fp),
                    'last_modified': last_modified(fp)
                }
                if relative_to:
                    entry['relative_path'] = os.path.relpath(fp, relative_to)
                results.append(entry)
    except (OSError, PermissionError):
        pass
    return results


def scan_files_recursive(dirpath, relative_to=None):
    """List all files in a directory recursively with metadata."""
    results = []
    if not os.path.isdir(dirpath):
        return results
    try:
        for root, dirs, files in os.walk(dirpath):
            # Skip hidden dirs and known noise
            dirs[:] = [d for d in dirs if d not in SKIP_PATTERNS and not d.startswith('.')]
            for name in sorted(files):
                fp = os.path.join(root, name)
                if os.path.isfile(fp):
                    entry = {
                        'name': name,
                        'md5': md5_file(fp),
                        'lines': file_line_count(fp),
                        'size_bytes': os.path.getsize(fp),
                        'last_modified': last_modified(fp)
                    }
                    if relative_to:
                        entry['relative_path'] = os.path.relpath(fp, relative_to)
                    results.append(entry)
    except (OSError, PermissionError):
        pass
    return results


def scan_skill_dirs(skills_path):
    """List skill directories with SKILL.md hash if present."""
    results = []
    if not os.path.isdir(skills_path):
        return results
    try:
        for name in sorted(os.listdir(skills_path)):
            skill_dir = os.path.join(skills_path, name)
            if os.path.isdir(skill_dir):
                entry = {
                    'name': name,
                    'file_count': sum(1 for _, _, fs in os.walk(skill_dir) for _ in fs),
                    'last_modified': dir_last_modified(skill_dir)
                }
                skill_md = os.path.join(skill_dir, 'SKILL.md')
                if os.path.isfile(skill_md):
                    entry['skill_md_md5'] = md5_file(skill_md)
                results.append(entry)
    except (OSError, PermissionError):
        pass
    return results


def scan_command_dirs(commands_path, relative_to=None):
    """List all command .md files recursively."""
    results = []
    if not os.path.isdir(commands_path):
        return results
    try:
        for root, dirs, files in os.walk(commands_path):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for name in sorted(files):
                if name.endswith('.md'):
                    fp = os.path.join(root, name)
                    rel = os.path.relpath(fp, commands_path)
                    entry = {
                        'name': rel,
                        'md5': md5_file(fp),
                        'lines': file_line_count(fp),
                        'last_modified': last_modified(fp)
                    }
                    results.append(entry)
    except (OSError, PermissionError):
        pass
    return results


def parse_settings_json(filepath):
    """Parse a settings.json and extract structured data."""
    if not os.path.isfile(filepath):
        return None
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return {'parse_error': True, 'raw_exists': True}

    result = {
        'exists': True,
        'md5': md5_file(filepath),
        'last_modified': last_modified(filepath)
    }

    # Extract hooks
    hooks = data.get('hooks', {})
    hook_summary = {}
    for event, entries in hooks.items():
        commands = []
        if isinstance(entries, list):
            for entry in entries:
                if isinstance(entry, dict):
                    for h in entry.get('hooks', []):
                        cmd = h.get('command', '')
                        if cmd:
                            commands.append(cmd)
                elif isinstance(entry, str):
                    commands.append(entry)
        hook_summary[event] = {
            'count': len(commands),
            'commands': commands,
            'is_empty_array': isinstance(entries, list) and len(entries) == 0
        }
    result['hooks'] = hook_summary

    # Extract permissions
    permissions = data.get('permissions', {})
    result['permissions'] = {
        'allow': permissions.get('allow', []),
        'deny': permissions.get('deny', [])
    }

    # Extract MCP servers if present
    mcp = data.get('mcpServers', {})
    if mcp:
        result['mcp_servers'] = list(mcp.keys())

    # Extract enabled MCP servers (settings.local.json pattern)
    enabled = data.get('enabledMcpjsonServers', [])
    if enabled:
        result['enabled_mcp_servers'] = enabled

    enable_all = data.get('enableAllProjectMcpServers')
    if enable_all is not None:
        result['enable_all_project_mcp'] = enable_all

    # Project metadata
    project = data.get('project', {})
    if project:
        result['project'] = project

    return result


def parse_mcp_json(filepath):
    """Parse .mcp.json and list all registered server names."""
    if not os.path.isfile(filepath):
        return []
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
        return sorted(data.get('mcpServers', {}).keys())
    except (json.JSONDecodeError, OSError):
        return []


def find_git_root(directory):
    """Walk up from directory to find the nearest .git root. Returns path or None."""
    current = os.path.abspath(directory)
    while True:
        if os.path.isdir(os.path.join(current, '.git')):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            return None
        current = parent


def detect_git_boundary(claude_dir, workspace_root):
    """Determine which config layers are visible when Claude Code boots in this directory.

    Claude Code resolves the project root from the nearest .git boundary.
    - Global ~/.claude/ is always visible
    - Workspace root .claude/ is only visible if the project's git root IS the workspace root
    - The project's own .claude/ is visible if it's at or under the git root

    Returns a dict describing the visibility context.
    """
    # The .claude dir's parent is where Claude Code would boot
    parent_dir = os.path.dirname(claude_dir)
    git_root = find_git_root(parent_dir)

    ws_abs = os.path.abspath(workspace_root)
    has_own_git = git_root is not None and os.path.abspath(git_root) != ws_abs
    git_root_rel = os.path.relpath(git_root, ws_abs) if git_root else None

    return {
        'has_own_git': has_own_git,
        'git_root': git_root_rel,
        'sees_global': True,  # ~/.claude/ is always visible
        'sees_workspace_root': not has_own_git,  # Only if git root == workspace root
        'sees_own_claude': True,  # The project's .claude/ is always visible to itself
        'mcp_json_visible': not has_own_git  # .mcp.json at workspace root only visible if same git root
    }


def find_claude_dirs(workspace_root):
    """Find all .claude directories recursively, respecting skip patterns."""
    results = []
    seen = set()
    for root, dirs, _files in os.walk(workspace_root):
        # Filter out skip patterns
        dirs[:] = [d for d in dirs if d not in SKIP_PATTERNS]

        if '.claude' in dirs:
            claude_path = os.path.join(root, '.claude')
            real_path = os.path.realpath(claude_path)
            if real_path in seen:
                continue
            seen.add(real_path)

            rel_path = os.path.relpath(claude_path, workspace_root)
            results.append({
                'absolute_path': claude_path,
                'relative_path': rel_path,
                'parent_dir': os.path.relpath(root, workspace_root)
            })
            # Also scan inside .claude for nested .claude dirs (accidental)
            nested_claude = os.path.join(claude_path, '.claude')
            if os.path.isdir(nested_claude):
                nested_real = os.path.realpath(nested_claude)
                if nested_real not in seen:
                    seen.add(nested_real)
                    nested_rel = os.path.relpath(nested_claude, workspace_root)
                    results.append({
                        'absolute_path': nested_claude,
                        'relative_path': nested_rel,
                        'parent_dir': os.path.relpath(claude_path, workspace_root),
                        'nested': True
                    })

    return results


def scan_claude_dir(claude_dir_info, workspace_root):
    """Fully scan a single .claude directory."""
    abs_path = claude_dir_info['absolute_path']
    rel_path = claude_dir_info['relative_path']

    # Git boundary detection
    git_context = detect_git_boundary(abs_path, workspace_root)

    entry = {
        'path': rel_path,
        'absolute_path': abs_path,
        'parent': claude_dir_info['parent_dir'],
        'nested': claude_dir_info.get('nested', False),
        'last_modified': dir_last_modified(abs_path),
        'is_template': any(t in rel_path for t in ['_template/', 'template/', 'templates/']),
        'git_boundary': git_context
    }

    # Hooks
    hooks_dir = os.path.join(abs_path, 'hooks')
    entry['hooks'] = scan_files_in_dir(hooks_dir)

    # Commands (recursive — commands can have subdirs)
    commands_dir = os.path.join(abs_path, 'commands')
    entry['commands'] = scan_command_dirs(commands_dir)

    # Skills
    skills_dir = os.path.join(abs_path, 'skills')
    entry['skills'] = scan_skill_dirs(skills_dir)

    # Rules
    rules_dir = os.path.join(abs_path, 'rules')
    entry['rules'] = scan_files_in_dir(rules_dir)

    # Settings
    entry['settings_json'] = parse_settings_json(os.path.join(abs_path, 'settings.json'))
    entry['settings_local_json'] = parse_settings_json(os.path.join(abs_path, 'settings.local.json'))

    # Other files (top-level only, not in known subdirs)
    known_subdirs = {'hooks', 'commands', 'skills', 'rules', 'session-context', 'worktrees'}
    other = []
    try:
        for name in sorted(os.listdir(abs_path)):
            fp = os.path.join(abs_path, name)
            if os.path.isfile(fp) and name not in ('settings.json', 'settings.local.json'):
                other.append({
                    'name': name,
                    'md5': md5_file(fp),
                    'size_bytes': os.path.getsize(fp)
                })
            elif os.path.isdir(fp) and name not in known_subdirs and name != '.claude':
                other.append({
                    'name': name + '/',
                    'type': 'directory',
                    'file_count': sum(1 for _, _, fs in os.walk(fp) for _ in fs)
                })
    except (OSError, PermissionError):
        pass
    entry['other'] = other

    # Subdirectory presence flags
    entry['has_hooks'] = os.path.isdir(hooks_dir) and len(entry['hooks']) > 0
    entry['has_commands'] = os.path.isdir(commands_dir) and len(entry['commands']) > 0
    entry['has_skills'] = os.path.isdir(skills_dir) and len(entry['skills']) > 0
    entry['has_rules'] = os.path.isdir(rules_dir) and len(entry['rules']) > 0
    entry['has_settings'] = entry['settings_json'] is not None
    entry['has_settings_local'] = entry['settings_local_json'] is not None

    # Empty directory check
    total_items = (
        len(entry['hooks']) + len(entry['commands']) + len(entry['skills']) +
        len(entry['rules']) + len(entry['other']) +
        (1 if entry['has_settings'] else 0) +
        (1 if entry['has_settings_local'] else 0)
    )
    entry['is_empty'] = total_items == 0

    return entry


def build_baseline(config_path, label):
    """Build a baseline inventory of a .claude config directory."""
    baseline = {
        'path': config_path,
        'label': label,
        'exists': os.path.isdir(config_path)
    }

    if not baseline['exists']:
        return baseline

    baseline['hooks'] = scan_files_in_dir(os.path.join(config_path, 'hooks'))
    baseline['commands'] = scan_command_dirs(os.path.join(config_path, 'commands'))
    baseline['skills'] = scan_skill_dirs(os.path.join(config_path, 'skills'))
    baseline['settings_json'] = parse_settings_json(os.path.join(config_path, 'settings.json'))
    baseline['settings_local_json'] = parse_settings_json(os.path.join(config_path, 'settings.local.json'))

    # Build lookup indexes for fast comparison
    baseline['hook_md5_index'] = {h['md5']: h['name'] for h in baseline['hooks'] if h['md5']}
    baseline['hook_name_index'] = {h['name']: h['md5'] for h in baseline['hooks'] if h['md5']}
    baseline['command_md5_index'] = {c['md5']: c['name'] for c in baseline['commands'] if c['md5']}
    baseline['command_name_index'] = {c['name']: c['md5'] for c in baseline['commands'] if c['md5']}
    baseline['skill_name_index'] = {s['name']: s.get('skill_md_md5') for s in baseline['skills']}

    return baseline


def main():
    parser = argparse.ArgumentParser(description='Scan all .claude/ directories in a workspace')
    parser.add_argument('--workspace', default=os.getcwd(), help='Workspace root path')
    parser.add_argument('--global-config', default=os.path.join(os.path.expanduser('~'), '.claude'),
                        help='Global Claude config path')
    parser.add_argument('--output', default=None, help='Output JSON path')
    args = parser.parse_args()

    workspace = os.path.abspath(args.workspace)
    global_config = os.path.abspath(args.global_config)

    # Default output path
    if args.output:
        output_path = os.path.abspath(args.output)
    else:
        datasets_dir = os.path.join(workspace, '.base', 'audits', 'data-sets')
        os.makedirs(datasets_dir, exist_ok=True)
        date_str = datetime.now().strftime('%Y-%m-%d')
        output_path = os.path.join(datasets_dir, f'claude-scan-{date_str}.json')

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Build baselines
    global_baseline = build_baseline(global_config, 'global')
    workspace_root_claude = os.path.join(workspace, '.claude')
    workspace_baseline = build_baseline(workspace_root_claude, 'workspace_root')

    # MCP registry
    mcp_servers = parse_mcp_json(os.path.join(workspace, '.mcp.json'))

    # Discover all .claude directories
    all_claude_dirs = find_claude_dirs(workspace)

    # Separate root from project-level
    project_dirs = [
        d for d in all_claude_dirs
        if d['relative_path'] != '.claude'
    ]

    # Scan each project-level .claude directory
    scanned_directories = []
    for dir_info in project_dirs:
        scanned = scan_claude_dir(dir_info, workspace)
        scanned_directories.append(scanned)

    # Build the complete dataset
    dataset = {
        'meta': {
            'scan_date': datetime.now(tz=timezone.utc).isoformat(),
            'workspace': workspace,
            'global_config': global_config,
            'scanner_version': '1.1.0',
            'total_directories_found': len(all_claude_dirs),
            'project_directories_scanned': len(project_dirs),
            'baseline_directories': 2
        },
        'baselines': {
            'global': global_baseline,
            'workspace_root': workspace_baseline,
            'mcp_registry': mcp_servers
        },
        'directories': scanned_directories
    }

    # Counts summary
    total_hooks = sum(len(d['hooks']) for d in scanned_directories)
    total_commands = sum(len(d['commands']) for d in scanned_directories)
    total_skills = sum(len(d['skills']) for d in scanned_directories)
    total_settings = sum(1 for d in scanned_directories if d['has_settings'])
    total_settings_local = sum(1 for d in scanned_directories if d['has_settings_local'])
    nested_count = sum(1 for d in scanned_directories if d['nested'])
    empty_count = sum(1 for d in scanned_directories if d['is_empty'])
    template_count = sum(1 for d in scanned_directories if d['is_template'])
    own_git_count = sum(1 for d in scanned_directories if d.get('git_boundary', {}).get('has_own_git', False))
    inherits_workspace_count = sum(1 for d in scanned_directories if not d.get('git_boundary', {}).get('has_own_git', False))

    dataset['summary'] = {
        'total_project_claude_dirs': len(project_dirs),
        'total_hooks': total_hooks,
        'total_commands': total_commands,
        'total_skills': total_skills,
        'total_settings_json': total_settings,
        'total_settings_local_json': total_settings_local,
        'nested_dirs': nested_count,
        'empty_dirs': empty_count,
        'template_dirs': template_count,
        'own_git_boundary': own_git_count,
        'inherits_workspace_root': inherits_workspace_count
    }

    # Write output
    with open(output_path, 'w') as f:
        json.dump(dataset, f, indent=2)

    # Print summary to stdout for the hook/task to capture
    print(json.dumps({
        'status': 'complete',
        'output': output_path,
        'summary': dataset['summary']
    }))


if __name__ == '__main__':
    main()
