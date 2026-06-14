<purpose>
Map existing projects to their parent initiatives and sync PAUL satellite data. Every project should trace to an initiative or be explicitly unparented.
</purpose>

<user-story>
As an operator with defined initiatives, I want my projects organized under the right strategic objectives with current PAUL data, so that I can see which work serves which goal.
</user-story>

<when-to-use>
- Phase 7 of new orientation (after Initiatives)
- Operator wants to reorganize project-to-initiative mappings
- Composed by new-orientation.md or reorientation.md
</when-to-use>

<steps>

<step name="pull_current_state" priority="first">
Pull initiatives and projects in parallel:
- base_list_projects(type="initiative")
- base_list_projects(type="project")

Display initiatives as target buckets, then list all projects with their current parent_id (or "unparented").

> ## Initiatives (target buckets)
> {For each: ID, title}
>
> ## Projects to Map
> {For each: ID, title, current parent, status, PAUL satellite if any}
>
> I'll go through each project. Tell me which initiative it belongs under, or say "none" to leave it unparented.
</step>

<step name="iterate_projects">
For each project without a parent (or with a stale/wrong parent):

> **{PRJ-ID}: {title}** ({status})
> {PAUL: satellite_name, phase if applicable}
>
> Which initiative does this serve?
> {List initiative options as [N] brackets}
> **[N+1] None — leave unparented**
> **[N+2] Archive — no longer active**

**Wait for response before moving to next project.**

When assigned, update via base_update_project(id, {parent_id: "INI-XXX"}).
</step>

<step name="sync_paul_data">
For each project that has a PAUL satellite (paul.json exists in its location):

1. Read the paul.json file from the project's location
2. Update the project's paul field with current: satellite_name, location, milestone, phase, loop_position, handoff status and path
3. Update via base_update_project

Report: "{N} PAUL satellites synced"
</step>

<step name="confirm_and_lock">
Display the final mapping:

> ## Initiative → Project Mapping
>
> **{INI-001}: {title}**
>   - {PRJ-XXX}: {title} (PAUL: {phase} | {status})
>   - ...
>
> **{INI-002}: {title}**
>   - ...
>
> **Unparented:**
>   - {PRJ-XXX}: {title}
>
> **[1] Looks right — lock it in**
> **[2] Move a project**

**Wait for response.**
</step>

<step name="lock">
Project mapping is locked.

Return to parent workflow with:
- `mapped_count`: number of projects assigned to initiatives
- `unparented_count`: number left without a parent
- `paul_synced`: number of PAUL satellites updated
- `completed_at`: current ISO date

This phase is complete. Parent workflow resumes.
</step>

</steps>

<output>
All projects mapped to initiatives via Apex MCP. PAUL satellite data synced from paul.json files.
</output>

<acceptance-criteria>
- [ ] Every project reviewed — assigned to initiative, left unparented, or archived
- [ ] Parent IDs set via base_update_project MCP
- [ ] PAUL satellites synced from source paul.json files
- [ ] Final mapping displayed and approved by operator
</acceptance-criteria>
