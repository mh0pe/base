---
name: history
description: Workspace evolution timeline
allowed-tools: [Read, Glob, Bash]
---

<objective>
Show workspace evolution — grooming history, audits, major changes over time.

**When to use:** "workspace history", "show evolution", "what's changed".
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/base-framework/tasks/history.md
</execution_context>

<context>
@.base/data/state.json
</context>

<process>
Follow task: @${CLAUDE_PLUGIN_ROOT}/base-framework/tasks/history.md
</process>

<success_criteria>
- [ ] Timeline of workspace events displayed
</success_criteria>
