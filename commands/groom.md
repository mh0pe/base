---
name: groom
description: Weekly workspace maintenance cycle
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion]
---

<objective>
Structured weekly maintenance — review each workspace area, update statuses, archive stale items, reduce drift.

**When to use:** Weekly maintenance, "groom my workspace", "run grooming".
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/base-framework/tasks/groom.md
@${CLAUDE_PLUGIN_ROOT}/base-framework/context/base-principles.md
@${CLAUDE_PLUGIN_ROOT}/base-framework/frameworks/audit-strategies.md
</execution_context>

<context>
$ARGUMENTS

@.base/workspace.json
@.base/data/state.json
</context>

<process>
Follow task: @${CLAUDE_PLUGIN_ROOT}/base-framework/tasks/groom.md
</process>

<success_criteria>
- [ ] All workspace areas reviewed
- [ ] Stale items addressed
- [ ] state.json updated with groom results
- [ ] Drift score recalculated
</success_criteria>
