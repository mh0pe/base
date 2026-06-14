<purpose>
Guide an operator through reorientation when an existing operator.json is present. Iterates through each section, showing current values and prompting for keep/reset decisions before composing relevant phase tasks.
</purpose>

<user-story>
As an operator who has been through orientation before, I want to selectively reset parts of my identity profile, so that my profile evolves with me without starting completely from scratch every time.
</user-story>

<when-to-use>
- operator.json already exists
- Operator chose [1] Full reorientation from entry point
</when-to-use>

<context>
@../templates/operator-json.md
</context>

<steps>

<step name="load_current_profile" priority="first">
Read `.base/operator.json` and display the full current profile.

> ## Current Operator Profile
>
> **Deep Why:** {current statement}
> *(Last set: {date})*
>
> **North Star:** {current metric} ({timeframe})
> *(Last set: {date})*
>
> **Values:** {v1}, {v2}, {v3}, {v4}, {v5}
> *(Last set: {date})*
>
> **Elevator Pitch:** {current pitch}
> *(Last set: {date})*
>
> **Surface Vision:** {current summary}
> *(Last set: {date})*

Then begin iterating through each section.
</step>

<step name="iterate_sections">
For each section in order (Deep Why, North Star, Key Values, Elevator Pitch, Surface Vision, Initiatives, Project Mapping, Task Seeding):

> **{Section Name}**
> Current: {current value — one-line summary}
> Last set: {date}
>
> **[1] Keep** — this still resonates
> **[2] Reorient** — this needs work
> **[3] Skip for now** — come back to it later

**Wait for response before moving to next section.**

If [2]: Load and execute the corresponding phase task (e.g., @deep-why.md for Deep Why, @initiatives.md for Initiatives, @project-mapping.md for Project Mapping, @task-seeding.md for Task Seeding), passing current value as "previous orientation" context so the operator can see what they had before. When phase task completes, capture new output and continue iteration.

If [1] or [3]: Keep current value, move to next section.

Track which sections were reoriented vs kept.
</step>

<step name="write_updated_profile">
After iterating all 8 sections:

1. Merge kept values with new values from reoriented sections
2. Update `last_updated` timestamp
3. Update `completed_at` only for sections that were reoriented
4. Write updated `.base/operator.json`
5. Display summary showing what changed:

> ## Reorientation Complete
>
> **Changed:** {list of reoriented sections}
> **Kept:** {list of kept sections}
> **Skipped:** {list of skipped sections}
>
> Profile updated at `.base/operator.json`.

**Wait for acknowledgment.**
</step>

</steps>

<output>
Updated `.base/operator.json` with selectively reoriented sections.
</output>

<acceptance-criteria>
- [ ] Current profile loaded and displayed
- [ ] Each section presented with keep/reorient/skip options
- [ ] Reoriented sections went through their full phase task
- [ ] Kept sections preserved unchanged
- [ ] operator.json updated with merged results
- [ ] Summary shows what changed vs what stayed
</acceptance-criteria>
