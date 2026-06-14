---
name: audit-claude
description: Audit .claude/ directories across workspace for sprawl, duplication, and misalignment
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion]
---

<objective>
Audit all .claude/ directories in this workspace. Discover sprawl, classify items against the global/workspace/project hierarchy, and remediate with operator approval at every step.

**When to use:** "audit claude config", "clean up .claude dirs", "check claude setup", after installing global tools.
</objective>

<execution_context>
@base-framework/tasks/audit-claude.md
@base-framework/frameworks/claude-config-alignment.md
</execution_context>

<context>
$ARGUMENTS

Global config: ~/.claude/
Workspace root config: .claude/
</context>

<process>
Follow task: @base-framework/tasks/audit-claude.md

The framework file defines classification rules, safety protocol, and output format.
The task file defines the step-by-step process.

Key principles:
- Every change requires operator approval
- Process from lowest risk to highest
- Never batch-delete without per-item confirmation
- Explain what, why, and what could go wrong for every change
- Copy-then-verify-then-remove, never move
</process>

<success_criteria>
- [ ] All .claude/ directories discovered and inventoried
- [ ] Items classified with evidence
- [ ] Operator confirmed classifications
- [ ] Remediation executed by risk group with verification
- [ ] Summary report with manual follow-up items
</success_criteria>
