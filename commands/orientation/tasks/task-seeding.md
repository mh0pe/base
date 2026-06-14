<purpose>
Seed initial tasks under projects after initiatives and project mapping are complete. Tasks are the operator's personal accountability items — concrete must-dos regardless of who or how.
</purpose>

<user-story>
As an operator with aligned initiatives and projects, I want to capture the immediate must-do items under each project, so that I have a clear picture of what needs to happen next.
</user-story>

<when-to-use>
- Phase 8 of new orientation (after Project Mapping)
- Operator wants to refresh their task list
- Composed by new-orientation.md or reorientation.md
</when-to-use>

<steps>

<step name="frame_and_filter" priority="first">
> Tasks are YOUR accountability items — things that must get done. Not Claude Code todos. Not aspirational ideas. Concrete next actions.
>
> We'll go initiative by initiative, project by project. For each project, I'll show you the current status and ask: "What must get done next?"
>
> You can skip any project that doesn't need tasks right now.
>
> **[1] Let's go — start with the highest priority initiative**
> **[2] Skip task seeding for now**

If [2]: Exit gracefully. Tasks can be added anytime via Apex MCP.

**Wait for response.**
</step>

<step name="iterate_by_initiative">
For each initiative (highest priority first):

> ## {INI-ID}: {initiative title}

For each project under the initiative:

> **{PRJ-ID}: {project title}** ({status})
> Next: {current next action from project data}
> {Blocked: {blocker} if applicable}
>
> Any must-do tasks to log under this project?
> Type them out, or say "skip" to move on.

**Wait for response.**

For each task the operator names:
- Create via base_add_project(type="task", parent_id="{PRJ-ID}", title="{task}")
- Confirm: "Logged: {task} under {project}"

Move to next project after each response.
</step>

<step name="summary">
After iterating all initiatives and projects:

> ## Tasks Seeded
>
> {For each initiative → project → tasks created}
>
> **Total:** {N} tasks across {N} projects
>
> **[1] Done — lock it in**
> **[2] Add more to a specific project**

**Wait for response.**
</step>

<step name="lock">
Task seeding is locked.

Return to parent workflow with:
- `tasks_created`: total count
- `projects_with_tasks`: count of projects that received tasks
- `completed_at`: current ISO date

This phase is complete. Parent workflow resumes.
</step>

</steps>

<output>
Tasks created in Apex via MCP under their parent projects. Operator's immediate accountability items are captured.
</output>

<acceptance-criteria>
- [ ] Each initiative's projects presented for task seeding
- [ ] Tasks created via base_add_project(type="task") with correct parent_id
- [ ] Operator could skip projects freely
- [ ] Summary displayed with total counts
- [ ] NEVER treated tasks as Claude Code internal todos
</acceptance-criteria>
