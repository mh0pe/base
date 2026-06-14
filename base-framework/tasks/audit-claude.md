<purpose>
Audit all .claude/ directories across a workspace. Discover sprawl, classify each item against the global/workspace/project hierarchy, plan remediation with operator approval at every step, and execute changes safely.
</purpose>

<user-story>
As an AI builder with multiple projects in my workspace, I want all my .claude/ directories audited for duplication, staleness, and misplacement, so that my Claude Code configuration is clean, consistent, and I know exactly what's project-specific vs what should be global.
</user-story>

<when-to-use>
- During BASE setup on an existing workspace with legacy projects
- Periodically as part of workspace optimization
- After installing global skills/hooks and wanting to clean up project copies
- When user says "audit my claude config", "clean up my .claude dirs", "check claude setup"
- Entry point routes here via /base:audit-claude
</when-to-use>

<framework>
@frameworks/claude-config-alignment.md
</framework>

<output-rules>
ALL audit findings MUST be written to a markdown report file at `.base/audits/claude-config-{YYYY-MM-DD}.md`.

Do NOT dump findings into the chat as inline text. The chat is for brief status updates, questions, and confirmations only. The report is where all detail lives.

The report must be:
- Written in clean markdown with tables, headers, and clear visual hierarchy
- Readable by a human who opens it in any markdown viewer
- Comprehensive: current state, classifications with evidence, remediation plan with risk levels, items kept and why

After writing the report, tell the operator: "Audit report written to `.base/audits/claude-config-{date}.md`. Review it, then tell me which remediation groups to execute."

During remediation execution, update the report with results (append a "Remediation Results" section).
</output-rules>

<steps>

<step name="scan" priority="first">
Run the scanner utility to produce a complete, verified dataset.

This step uses a deterministic Python script that scans the entire workspace and produces structured JSON. The script handles all data collection — baselines, directory discovery, file hashing, settings parsing. Claude does NOT gather this data manually.

**Run the scanner:**
```
python3 ~/.claude/base-framework/utils/scan-claude-dirs.py --workspace {workspace_root}
```

The script outputs a JSON file to `.base/audits/data-sets/claude-scan-{date}.json` containing:
- **Baselines:** Complete inventory of global `~/.claude/` and workspace root `.claude/` (every file with MD5 hash)
- **MCP registry:** All server names from `.mcp.json`
- **Directories:** Every project-level `.claude/` directory with full contents (hooks, commands, skills, rules, settings — all with MD5 hashes)
- **Summary:** Counts of hooks, commands, skills, settings files, nested dirs, empty dirs, templates

**Read the JSON output.** This is your single source of truth for all subsequent steps. Do not make ad-hoc bash calls to re-discover or re-hash files. If it's not in the scan data, re-run the scanner.

If the scanner fails, diagnose and fix before proceeding. Do not fall back to manual scanning.
</step>

<step name="classify">
Classify every item in every project-level .claude/ directory.

**CRITICAL: Git boundary awareness.**

The scanner dataset includes `git_boundary` data for each directory. This tells you what each project actually sees when Claude Code boots there:

- `has_own_git: true` → This project has its own git root. It does NOT see the workspace root `.claude/` or workspace `.mcp.json`. It only sees global `~/.claude/` + its own `.claude/`.
- `has_own_git: false` → This project inherits the workspace root. It sees global `~/.claude/` + workspace root `.claude/` + its own `.claude/`.

**This changes what "duplicate" means.** If a project has its own git root and contains a hook that also exists in the workspace root `.claude/`, that's not a duplicate running twice — the workspace root version is invisible to that project. Removing the local copy would leave the project with NO version of that hook.

For own-git projects, the right framing is:
- Does a current version exist in **global** `~/.claude/`? If yes, the local copy is a true duplicate (global is always visible).
- Does a version only exist in **workspace root** `.claude/`? Then the local copy is the project's ONLY access to that functionality. The right recommendation is to **promote to global** so all projects benefit, THEN clean up local copies.
- Is the local copy an outdated version of something in a baseline? It's DIVERGED — recommend updating to current or promoting current to global.

**Classification order:**

1. **TEMPLATE** — In a template directory? Mark and skip.
2. **ACCIDENTAL** — Nested .claude dirs, empty dirs.
3. **DUPLICATE** — MD5 matches a baseline the project can ACTUALLY SEE:
   - Global baseline: always checked (always visible)
   - Workspace root baseline: only checked if `has_own_git: false`
   - Match against visible baseline → DUPLICATE (safe to remove)
   - Match against non-visible baseline → NOT a duplicate. See PROMOTE_TO_GLOBAL.
4. **DIVERGED** — Same-named file exists in a visible baseline but MD5 differs.
5. **PROMOTE_TO_GLOBAL** — Item exists in workspace root `.claude/` (or same pattern across multiple projects) but NOT in global `~/.claude/`. These are hooks/skills/commands the user wants everywhere but hasn't centralized. This is the most valuable finding — "put this in global and stop copying it into every project." When multiple projects have the same hook, that's strong evidence.
6. **STALE** — References things that no longer exist:
   - settings.json hooks pointing to missing files
   - settings.local.json MCP servers not in registry (also check if MCP is even visible per git boundary)
   - Files untouched for 60+ days in an inactive project
7. **GLOBAL_CANDIDATE** — Exists only in one project, serves a user-level purpose, not in any baseline.
8. **PROJECT_SPECIFIC** — Everything else that legitimately belongs in the project.

**Classification rules:**
- A file is DUPLICATE only if its MD5 matches a baseline the project can actually see
- A file matching a non-visible baseline is a signal that something should be promoted to global
- PROMOTE_TO_GLOBAL is the key recommendation for own-git projects with hooks/skills that mirror workspace root
- When multiple projects share the same hook, that's strong evidence it belongs in global
- When in doubt, check the hash (hashes don't lie) and the git_boundary data (assumptions lie)
</step>

<step name="settings_reconciliation">
Analyze settings.json and settings.local.json files specifically.

These are the most dangerous files because they control Claude Code behavior:

1. For each project-level settings.json:
   a. Parse hook definitions — list every hook command
   b. For each hook, check: does this reference a local file? Does that file exist? Is it a duplicate?
   c. Check if hook arrays are empty `[]` — this OVERRIDES global hooks with nothing
   d. Compare hook list against global settings.json hooks — identify double-execution patterns
   e. Check permissions — do they conflict with or duplicate global?

2. For each project-level settings.local.json:
   a. List every entry in enabledMcpjsonServers
   b. Check each server name against MCP baseline — flag any that don't exist
   c. Note enableAllProjectMcpServers boolean

3. **Git-aware analysis** — For each project, use git_boundary data to determine:
   - Which hooks are ACTUALLY running (global + project? or global + workspace root + project?)
   - Is the project's `.mcp.json` visibility correct? (own-git projects can't see workspace .mcp.json)
   - Would removing a local hook leave the project with NO version of that functionality?

4. Build a "Settings Danger Report" section:
   - Which projects have duplicate hooks running (only possible if project inherits workspace root)
   - Which own-git projects rely on local hooks as their ONLY source of CARL/time/etc functionality
   - Which settings.json files will have dangling references after hook files are removed
   - Which settings.local.json files have stale MCP entries (or reference MCP servers they can't even see)
</step>

<step name="verify_classifications">
Self-audit: verify every classification is correct before writing the report.

This step exists because classification errors are the most damaging mistake this audit can make. A misclassified DUPLICATE that's actually PROJECT_SPECIFIC means deleting something the user needs.

**Verification checks:**

1. **DUPLICATE verification** — For every item classified as DUPLICATE:
   - Confirm the baseline file it supposedly duplicates actually exists
   - Confirm the MD5 hashes actually match (re-check, don't trust prior step)
   - Confirm the baseline version is the current/active version

2. **GLOBAL_CANDIDATE verification** — For every item classified as GLOBAL_CANDIDATE:
   - Search global baseline for any file with the same name (case-insensitive)
   - Search workspace root baseline for any file with the same name
   - Search for the same MD5 hash across all baselines (catches renamed copies)
   - If found anywhere → reclassify as DUPLICATE

3. **DIVERGED verification** — For every item classified as DIVERGED:
   - Confirm both versions actually exist and differ
   - Note which is newer (by file modification date)

4. **STALE verification** — For every STALE settings entry:
   - Confirm the referenced resource actually doesn't exist (not just renamed)
   - Check both .mcp.json AND global settings for MCP servers

5. **Completeness check** — Count total items classified vs total items discovered. If they don't match, something was missed. Find and classify the missing items.

6. **Cross-reference check** — For items in the remediation plan that depend on each other (e.g., deleting a hook file + cleaning the settings.json that references it), verify both sides of the dependency are in the plan.

If any reclassifications happen in this step, update all downstream plan entries.
</step>

<step name="build_report">
Write the complete audit report to `.base/audits/claude-config-{YYYY-MM-DD}.md`.

Report structure:
1. **MD5 disclaimer** — Always include this at the top, right after the metadata block, as a blockquote:
   > *\* This audit uses MD5 fingerprinting to classify files. An MD5 hash is a unique fingerprint generated from a file's contents — if two files produce the same fingerprint, they are byte-for-byte identical. If the fingerprints differ, the files are different, even if they share the same name. This means every "DUPLICATE" classification in this report is provably exact, and every "DIVERGED" classification is provably different — not guessed, not assumed.*
2. **Summary** — What's wrong, what's fine, item counts by classification
2. **Baselines** — Brief description of what exists globally and at workspace root (so the reader understands what "duplicate of" means)
3. **Findings by Directory** — Each project .claude/ gets its own section with:
   - Table of items: item path, classification, evidence (MD5 match, baseline reference)
   - Last modified date
   - Risk notes specific to that directory
4. **Settings Reconciliation** — Dangerous patterns: duplicate hook execution, stale MCP refs, empty hook overrides
5. **Remediation Plan** — Grouped by risk level (1-6), each item has:
   - Item number
   - Exact path
   - Action (delete, clean, keep, promote)
   - Why (with specific evidence)
   - Dependencies (e.g., "after removing hook file, settings.json needs cleanup in Group 4")
6. **Items Kept (No Action)** — What's staying and exactly why
7. **Next Steps** — What the operator should do

Tell the operator: "Audit report written to `.base/audits/claude-config-{date}.md`. Review it, then we'll decide how to handle remediation."

**Wait for operator to review the report before proceeding to graduation routing.**
</step>

<step name="graduate_to_project">
Route remediation into a structured execution path. Present the operator with options.

**Display routing prompt:**
```
════════════════════════════════════════
AUDIT COMPLETE — REMEDIATION ROUTING
════════════════════════════════════════

The audit report is ready at .base/audits/claude-config-{date}.md

How would you like to handle remediation?

[1] Create standalone PAUL project
    → Initializes a new PAUL project seeded with audit findings
    → Best for: large remediation, multiple phases, traceability needed

[2] Add milestone to existing PAUL project
    → Adds a remediation milestone to a registered satellite
    → Best for: audit is part of ongoing workspace optimization work

[3] Execute ad-hoc (legacy)
    → Proceed with group-by-group remediation in this session
    → Best for: small, straightforward cleanups

════════════════════════════════════════
```

**If option 1 (standalone PAUL project):**

1. Ask: "Where should the project be created? (e.g., `projects/claude-audit-remediation`)"
2. If user has no obvious location, suggest `projects/` as a convention
3. Provide instructions:
   ```
   To proceed:
   1. mkdir -p {path}
   2. cd {path}
   3. Run /paul:init
   4. When defining scope, reference the audit report:
      @.base/audits/claude-config-{date}.md

   The audit report's Remediation Plan section maps directly
   to PAUL phases — each remediation group can be a phase.
   ```
4. Do NOT auto-run /paul:init — the operator invokes it in the right context
5. Exit this workflow (remediation happens through PAUL)

**If option 2 (add milestone to existing PAUL project):**

1. Read `.base/workspace.json` for registered satellites:
   ```
   Read workspace.json → satellites array → list projects with paths and current status
   ```
2. Present registered projects:
   ```
   Registered PAUL projects:
     [a] apps/base — v2.4 Config Governance (in progress)
     [b] apps/casegate-v2 — v1.0 (if registered)
     ...

   Select a project, or provide a path:
   ```
3. After selection, provide instructions:
   ```
   To proceed:
   1. In the selected project, run /paul:milestone
   2. When defining scope, reference the audit report:
      @.base/audits/claude-config-{date}.md

   The audit report's Remediation Plan section provides
   the scope — each remediation group maps to a phase.
   ```
4. Do NOT auto-run /paul:milestone
5. Exit this workflow (remediation happens through PAUL)

**If option 3 (ad-hoc / legacy):**

Proceed directly to the execute_remediation step below. This preserves the original workflow behavior for operators who prefer immediate execution.

```
Proceeding with ad-hoc remediation.
Tell me which groups to execute (or "approve all").
```
</step>

<step name="execute_remediation">
Execute approved remediation items one group at a time.

For each approved group:
1. Announce in chat: "Executing Group {N}: {description} ({count} items)"
2. For each item:
   a. Execute the change
   b. If the change involves a settings.json modification, verify the JSON is still valid after edit
   c. Brief confirmation in chat: "{path} — done"
3. After each group completes:
   a. Verify no broken references were created
   b. Report in chat: "Group {N} complete. {count} items processed."
4. If any item fails or produces an unexpected result, STOP and report to operator

**Between groups, pause and confirm: "Group {N} complete. Proceed to Group {N+1}?"**
</step>

<step name="post_remediation_verify">
Verify the workspace is healthy after all remediation and update the report.

1. Re-scan every `.claude/` directory that was modified
2. For each modified directory verify:
   - settings.json is valid JSON (if it was modified)
   - No hook arrays reference files that don't exist
   - No empty `.claude/` directories left behind (unless intentional)
   - No orphaned subdirectories (hooks/ dir with no hooks in it)
3. Run a quick re-discovery scan to catch anything the remediation might have exposed
4. Append a "Remediation Results" section to the audit report file:
   - What was executed (by group)
   - What was verified
   - Any issues found during verification
   - Projects the operator should test by opening Claude Code in them

Tell the operator: "Remediation complete. Report updated. Recommend testing Claude Code in: {list of modified projects}."
</step>

</steps>

<output>
Complete .claude/ directory audit with inventory, classification, verified remediation, and post-remediation verification — all in a structured markdown report.
</output>

<acceptance-criteria>
- [ ] Three baselines built (global, workspace root, MCP registry) before any classification
- [ ] Every file hashed with MD5 — no classification without hash evidence
- [ ] Every item classified against ALL baselines, not just one
- [ ] Self-audit pass completed — all classifications verified, no GLOBAL_CANDIDATE that's actually a DUPLICATE
- [ ] Item count verified: classified items == discovered items (nothing missed)
- [ ] Settings files analyzed for dangerous patterns (empty hooks, stale MCP refs, double execution)
- [ ] Report written to .base/audits/ as structured markdown (not inline chat)
- [ ] Operator reviewed report and approved remediation before execution
- [ ] Changes executed one group at a time with verification between groups
- [ ] Post-remediation scan confirms no broken references or invalid JSON
- [ ] Report updated with remediation results
</acceptance-criteria>
