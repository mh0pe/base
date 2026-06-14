<purpose>
Orchestrate a full first-time orientation through all 5 phases: Deep Why, North Star, Key Values, Elevator Pitch, Surface Vision. Composes each phase task sequentially, passing context forward, and produces operator.json at the end.
</purpose>

<user-story>
As an operator setting up my workspace for the first time, I want a guided walkthrough of my identity anchors, so that my initiatives, projects, and tasks align to who I am and where I'm going.
</user-story>

<when-to-use>
- No operator.json exists yet
- Entry point routes here when operator chooses [1] Begin orientation
</when-to-use>

<context>
@../templates/operator-json.md
</context>

<steps>

<step name="set_expectations" priority="first">
Brief the operator on what's coming.

> You'll go through 5 exercises. Each builds on the last:
>
> 1. **Deep Why** — excavate your root motivation (5 layers)
> 2. **North Star** — define the one metric everything points at
> 3. **Key Values** — narrow to your top 5 operating principles
> 4. **Elevator Pitch** — synthesize who you are in 30 seconds
> 5. **Surface Vision** — anchor a tangible picture of the future
>
> Take your time. There's no wrong answers, but surface-level ones won't serve you.
>
> **[1] Let's go — start with Deep Why**
> **[2] I need a minute — come back to this**

If [2]: Exit gracefully. Orientation can resume anytime via `/base:orientation`.

**Wait for response.**
</step>

<step name="phase_1_deep_why">
Load and execute @deep-why.md

Pass no prior context (this is the first phase).

When deep-why.md completes and locks its result, capture the output (layers + statement) and continue here.
</step>

<step name="phase_2_north_star">
Load and execute @north-star.md

Pass context: the Deep Why statement from Phase 1.

When north-star.md completes and locks its result, capture the output (metric + timeframe + rationale) and continue here.
</step>

<step name="phase_3_key_values">
Load and execute @key-values.md

Pass context: Deep Why statement + North Star metric.

When key-values.md completes and locks its result, capture the output (5 ranked values with meanings) and continue here.
</step>

<step name="phase_4_elevator_pitch">
Load and execute @elevator-pitch.md

Pass context: Deep Why statement + North Star metric + Key Values list.

When elevator-pitch.md completes and locks its result, capture the output (4 floors + full pitch) and continue here.
</step>

<step name="phase_5_surface_vision">
Load and execute @surface-vision.md

Pass context: Deep Why statement + North Star metric + Key Values + Elevator Pitch.

When surface-vision.md completes and locks its result, capture the output (scenes + summary) and continue here.
</step>

<step name="synthesize_and_write">
All 5 phases complete. Synthesize into operator.json.

1. Read @../templates/operator-json.md for schema
2. Populate all fields from captured phase outputs
3. Write to `.base/operator.json`
4. Display the complete profile in a clean summary:

> ## Your Operator Profile
>
> **Deep Why:** {statement}
> **North Star:** {metric} ({timeframe})
> **Values:** {value1}, {value2}, {value3}, {value4}, {value5}
> **Elevator Pitch:** {full pitch}
> **Surface Vision:** {summary}
>
> Profile saved to `.base/operator.json`.
>
> **[1] Looks right — done**
> **[2] Something's off — let me adjust a section**

If [2]: Ask which section, load that specific task for revision, then re-write operator.json.

**Wait for response.**
</step>

<step name="phase_6_initiatives">
Load and execute @initiatives.md

Pass context: Full operator profile (Deep Why, North Star, Values).

When initiatives.md completes and locks its result, capture the output (initiative IDs and titles) and continue here.
</step>

<step name="phase_7_project_mapping">
Load and execute @project-mapping.md

Pass context: Created initiatives from Phase 6.

When project-mapping.md completes and locks its result, capture the output (mapping counts, PAUL sync counts) and continue here.
</step>

<step name="phase_8_task_seeding">
Load and execute @task-seeding.md

Pass context: Initiative → Project mapping from Phase 7.

When task-seeding.md completes and locks its result, capture the output (task counts) and continue here.
</step>

<step name="orientation_complete">
All 8 phases complete. Display final summary:

> ## Orientation Complete
>
> **Operator Profile:** `.base/operator.json`
> - Deep Why, North Star, Values, Pitch, Vision — locked
>
> **Initiatives:** {count} defined, aligned to North Star
> **Projects:** {mapped_count} mapped to initiatives, {unparented_count} unparented
> **PAUL Satellites:** {paul_synced} synced
> **Tasks:** {tasks_created} seeded across {projects_with_tasks} projects
>
> You're oriented. Run `/base:orientation` anytime to review or reorient.
</step>

</steps>

<output>
Complete workspace orientation: operator.json populated, initiatives defined, projects mapped, PAUL synced, tasks seeded.
</output>

<acceptance-criteria>
- [ ] All 8 phase tasks executed in order
- [ ] Each phase locked before advancing to next
- [ ] Context passed forward between phases
- [ ] operator.json written with all fields populated
- [ ] Initiatives created via Apex MCP
- [ ] Projects mapped to initiatives with PAUL data synced
- [ ] Tasks seeded under projects
- [ ] Operator reviewed and approved at each phase
</acceptance-criteria>
