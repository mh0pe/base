<purpose>
Guide the operator through defining or reviewing goal-oriented initiatives aligned to their North Star. Each initiative is a measurable strategic objective, not an entity or project.
</purpose>

<user-story>
As an operator who has completed their identity profile, I want to define the strategic objectives my work serves, so that every project and task traces back to a clear goal.
</user-story>

<when-to-use>
- Phase 6 of new orientation (after Surface Vision)
- Operator chose to reorient their initiatives specifically
- Composed by new-orientation.md or reorientation.md
</when-to-use>

<steps>

<step name="ground_in_profile" priority="first">
<if condition="previous initiatives exist">
Pull current initiatives via base_list_projects(type="initiative") and display them:

> ## Current Initiatives
>
> {For each initiative: title, description, status, project count}
>
> We'll review each one against your North Star.
</if>

<if condition="no initiatives exist">
> Your North Star: *"{north_star_metric}"*
> Your Deep Why: *"{deep_why_statement}"*
>
> Initiatives are the strategic objectives that move you toward the North Star. NEVER confuse them with businesses or entities — an initiative is a measurable goal.
>
> Example: Not "C&C Strategic Consulting" but "Build C&C to $7k/month MRR"
>
> What are the 2-4 major objectives you're working toward right now? Think in terms of outcomes, not labels.
</if>

**Wait for response.**
</step>

<step name="define_each_initiative">
For each initiative the operator names:

> **Initiative: "{title}"**
>
> 1. How does this connect to your North Star?
> 2. What's the key metric or success criteria?
> 3. Is there a timeframe?

Capture: title, description, priority, category, metric, timeframe.

NEVER let an initiative through that is actually an entity (person, business, org). Push back: "That's a business name, not a goal. What's the measurable objective for that business?"

**Wait for response between each initiative.**
</step>

<step name="confirm_and_write">
Present all initiatives:

> ## Your Initiatives
>
> 1. **{title}** — {description} ({metric}, {timeframe})
> 2. **{title}** — {description} ({metric}, {timeframe})
> ...
>
> **[1] Lock these in**
> **[2] Add another**
> **[3] Edit one**
> **[4] Remove one**

When locked, write each initiative via base_add_project(type="initiative") with full metadata.

**Wait for response.**
</step>

<step name="lock">
Initiatives are locked.

Return to parent workflow with:
- `initiatives`: array of created initiative IDs and titles
- `completed_at`: current ISO date

This phase is complete. Parent workflow resumes.
</step>

</steps>

<output>
Initiatives created in Apex via MCP. Each has title, description, priority, category, metric alignment to North Star.
</output>

<acceptance-criteria>
- [ ] Each initiative is a measurable goal, not an entity
- [ ] Each initiative connects to the North Star
- [ ] Written via base_add_project MCP, not manual file edits
- [ ] Operator approved the final set
</acceptance-criteria>
