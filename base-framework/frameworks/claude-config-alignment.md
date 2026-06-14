# Claude Config Alignment Strategy

Standalone strategy for auditing `.claude/` directory sprawl across a workspace. Discovers all `.claude/` directories, catalogs their contents, classifies each item against a global/workspace/project hierarchy, and produces a remediation plan.

Designed to be composed into any audit workflow that touches the system layer. The `/base:audit-claude` command references this strategy directly. The general `/base:audit` can compose it in when running system-layer checks.

---

## When to Use

- During initial BASE setup on an existing workspace (lots of legacy `.claude/` dirs)
- As part of periodic workspace audits
- After installing a new tool/skill globally and wanting to clean up project-level copies
- When the user suspects their Claude Code config is fragmented

---

## Discovery Rules

### What to scan
- All directories named `.claude` under the workspace root
- Recursively (projects may nest: `apps/foo/bar/.claude/`)

### What to skip
- `node_modules/` — third-party packages may contain `.claude/` dirs
- `_archive/` — archived projects are frozen, don't audit
- `.git/` — git internals
- `vendor/`, `dist/`, `build/` — build artifacts

### What to catalog per directory
For each discovered `.claude/` directory, record:
- **Path** (relative to workspace root)
- **hooks/** — list filenames
- **commands/** — list subdirectories and files
- **skills/** — list skill directories
- **rules/** — list files
- **settings.json** — exists? contents summary
- **settings.local.json** — exists? contents summary
- **Other files** — anything unexpected

---

## Git Boundary Awareness

Understanding git boundaries is critical for correct classification. The scanner dataset includes `git_boundary` data for each directory.

### How git boundaries affect visibility

- **`has_own_git: true`** — This project has its own git root. It does NOT see the workspace root `.claude/` or workspace `.mcp.json`. It only sees global `~/.claude/` + its own `.claude/`.
- **`has_own_git: false`** — This project inherits the workspace root. It sees global `~/.claude/` + workspace root `.claude/` + its own `.claude/`.

### What this changes about classification

If a project has its own git root and contains a hook that also exists in the workspace root `.claude/`, that's **not a duplicate running twice** — the workspace root version is invisible to that project. Removing the local copy would leave the project with NO version of that hook.

For own-git projects, the right framing is:
- Does a current version exist in **global** `~/.claude/`? If yes, the local copy is a true DUPLICATE (global is always visible).
- Does a version only exist in **workspace root** `.claude/`? Then the local copy is the project's ONLY access to that functionality. The right recommendation is PROMOTE_TO_GLOBAL — centralize it so all projects benefit, then clean up local copies.
- Is the local copy an outdated version of something in a baseline? It's DIVERGED.

---

## Classification Rules

Each item found in a project-level `.claude/` must be classified into exactly one category. These rules define how.

**Classification order:** TEMPLATE → ACCIDENTAL → DUPLICATE → DIVERGED → PROMOTE_TO_GLOBAL → STALE → GLOBAL_CANDIDATE → PROJECT_SPECIFIC

### DUPLICATE — Exists in a visible baseline, safe to remove

An item is a DUPLICATE if:
- Its MD5 hash matches a file in a baseline the project can **actually see**
- Global baseline (`~/.claude/`): always checked — global is always visible
- Workspace root baseline (`.claude/`): only checked if `has_own_git: false`
- A match against a **non-visible** baseline (workspace root for own-git projects) is NOT a duplicate — see PROMOTE_TO_GLOBAL
- Common examples: hooks copied into project dirs that now run globally, skills that were installed globally after being copied locally

**Verification before removal:**
1. Confirm the global version is the current/active version (not the other way around)
2. Confirm the project's `settings.json` doesn't reference the local copy with a relative path that would break if removed
3. If the local copy has modifications not in the global version, flag as DIVERGED instead

### DIVERGED — Local copy differs from global

An item is DIVERGED if:
- A version exists both locally and globally
- The local copy has meaningful differences (not just whitespace or path variations)
- Requires human decision: merge local changes into global? Keep local override? Or discard local changes?

**Never auto-resolve diverged items. Always present both versions and ask.**

### PROMOTE_TO_GLOBAL — Centralize to global, then clean up copies

An item is PROMOTE_TO_GLOBAL if:
- It exists in workspace root `.claude/` (or the same pattern appears across multiple own-git projects) but NOT in global `~/.claude/`
- For own-git projects: a file matching a non-visible baseline (workspace root) is NOT a duplicate — it's a signal something should be centralized
- When multiple projects have the same hook with the same MD5, that's strong evidence it belongs in global
- This is the most valuable finding: "put this in global and stop copying it into every project"

**PROMOTE_TO_GLOBAL is about removing the need for copies.** Once promoted, all project copies become true DUPLICATES (global is always visible) and can be safely removed.

**Promotion is a suggestion, never automatic.** After promoting to global, the global `settings.json` must also register the hook or it won't fire.

### GLOBAL_CANDIDATE — Should be promoted to global (single occurrence)

An item is a GLOBAL_CANDIDATE if:
- It exists in a project-level `.claude/` but NOT in global
- It serves a user-level purpose (not project-specific)
- It would be useful across multiple projects
- Examples: a custom skill the user installed in one project but uses everywhere, a hook that provides general utility

**Promotion is a suggestion, never automatic.** Present the item, explain why it's a candidate, let operator decide.

### PROJECT_SPECIFIC — Legitimately belongs here

An item is PROJECT_SPECIFIC if:
- It references project-local paths, configs, or conventions
- It only makes sense in the context of this specific project
- Examples: project-specific commands, MCP server lists tailored to that project's stack, hooks that interact with project-local files

**These stay. Note them for reference but take no action.**

### STALE — References things that no longer exist

An item is STALE if:
- settings.json references MCP servers that aren't in the current `.mcp.json` or global config
- hooks reference scripts or tools that have been renamed or removed
- Settings use old configuration patterns that Claude Code no longer supports
- The `.claude/` directory hasn't been modified in 60+ days AND the project itself shows no recent activity

**Present specific evidence of staleness. Never assume — prove it.**

### ACCIDENTAL — Clearly unintentional

An item is ACCIDENTAL if:
- Nested `.claude/.claude/` directories
- Empty `.claude/` directories (no files at all)
- `.claude/` inside directories that aren't projects (temp dirs, scratch folders)

**Safe to remove, but still confirm with operator.**

### TEMPLATE — Intentional scaffold template

An item is TEMPLATE if:
- It lives in a directory named `_template/`, `template/`, or `templates/`
- It contains placeholder values (e.g., `{{PROJECT_NAME}}`)
- It's designed to be copied, not used directly

**Never modify templates. Note them and move on.**

---

## Settings Reconciliation

Project-level `settings.json` and `settings.local.json` require special handling because they override global settings.

### Check for
1. **Hook definitions that duplicate global hooks** — If global `settings.json` already runs `base-pulse-check.py` on UserPromptSubmit, a project that also defines it runs it twice (or runs a stale version)
2. **Stale MCP server references** — Server names change. Old lists reference servers that no longer exist
3. **Empty hook arrays** — `"UserPromptSubmit": []` overrides global hooks with nothing, potentially breaking the user's setup
4. **Permission overrides** — Project-level allow/deny that may conflict with or duplicate global permissions
5. **enabledMcpjsonServers** — Lists that reference old server names

### Critical safety rule
**An empty hooks array `[]` in a project settings.json OVERRIDES the global hooks with nothing.** This is the most dangerous pattern — it silently disables all hooks for that project. Always flag this explicitly.

---

## Remediation Safety Protocol

This is the most important section. `.claude/` configuration is what makes Claude Code work. A broken config means a broken development environment. Every remediation action must follow these rules:

### Before any change
1. **Explain what will change and why** — No "cleaning up your config." Say exactly: "Removing `apps/casegate-v2/.claude/hooks/carl-hook.py` because an identical version runs globally from `~/.claude/hooks/dynamic-rules-loader.py`. The global hook already fires on every prompt in every project."
2. **Show evidence** — Side-by-side comparison, file dates, path references
3. **Wait for explicit approval** — Not "I'll go ahead and clean these up." Ask: "Approve this removal? [y/n]"

### During changes
4. **One category at a time** — Process all ACCIDENTAL items first (lowest risk), then DUPLICATES, then STALE, then DIVERGED. Save GLOBAL_CANDIDATE promotions for last.
5. **Verify after each change** — After removing a hook, confirm the project's settings.json no longer references it. After removing a skill, confirm no commands reference it.
6. **Never delete settings.json itself** — Even if everything in it is stale. The file's existence may matter. Clean its contents instead, or flag for operator to remove manually.

### After all changes
7. **Summary report** — What was changed, what was kept, what needs manual follow-up
8. **Recommend a test** — "Open Claude Code in {project} and verify hooks fire correctly"

### What this workflow NEVER does
- Modify `~/.claude/` (global config) without explicit promotion approval
- Delete a `.claude/` directory entirely (may have gitignore or settings implications)
- Batch-delete without per-item confirmation
- Assume a "messy" config is wrong — it may be working exactly as intended
- Move files between directories (copy + verify + then remove original)

---

## Output Format

The discovery phase produces an inventory. Present it as:

```
## .claude/ Directory Inventory

Found {N} .claude/ directories ({N} excluding templates and root).

### {relative/path/.claude/}
  hooks/: carl-hook.py, get-current-time-cst.py
  settings.json: yes (hooks: 2 UserPromptSubmit)
  settings.local.json: yes (MCP servers: 12)
  skills/: ui-ux-pro-max/
  commands/: (none)
  Last modified: 2026-02-26

  Classification:
    - hooks/carl-hook.py → DUPLICATE (identical to ~/.claude/hooks/dynamic-rules-loader.py)
    - hooks/get-current-time-cst.py → DUPLICATE (identical to ~/.claude/hooks/get-current-time-cst.sh)
    - settings.json hooks → STALE (references local hook paths that would be removed)
    - settings.local.json → PROJECT_SPECIFIC (MCP server list is project-tailored)
    - skills/ui-ux-pro-max/ → DUPLICATE (exists at ~/.claude/skills/ui-ux-pro-max/)
```

The remediation phase groups by action type and risk level:

```
## Remediation Plan

### Safe Removals (ACCIDENTAL)
1. apps/hunter-exotics/.claude/.claude/ — nested .claude dir (accidental)
   Action: Delete entire nested directory
   Risk: None

### Duplicate Removals
2. apps/casegate-v2/.claude/hooks/carl-hook.py — identical to global
   Action: Delete file
   Risk: Low — must also clean settings.json hook reference

(... etc, one per item ...)

### Requires Decision (DIVERGED)
5. apps/hunter-exotics/.claude/settings.local.json — has project-specific MCP list
   Local version: [12 servers including project-specific ones]
   Global version: [different set]
   Recommendation: Keep as PROJECT_SPECIFIC
```

---

## Composability

This strategy is a standalone reference document. It does not modify or depend on other strategy files. Any workflow can compose it in:

- `/base:audit-claude` — reads this strategy directly as its framework
- `/base:audit` — can reference this when auditing the system-layer area
- `/base:groom` — can optionally flag `.claude/` drift during system-layer groom step
- Manual invocation — an operator can ask "audit my .claude dirs" and Claude reads this file

No registration in workspace.json is required. No modification to audit-strategies.md is needed.
