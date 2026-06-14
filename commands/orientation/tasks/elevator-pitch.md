<purpose>
Synthesize the operator's identity into a 4-floor elevator pitch — a 30-second statement of who they are, what they do, why it matters, and where they're going. Built on top of Deep Why, North Star, and Values.
</purpose>

<user-story>
As an operator, I want a clear, statable pitch for who I am and what I'm about, so that I can articulate my value to anyone in 30 seconds without fumbling.
</user-story>

<when-to-use>
- Phase 4 of new orientation (after Key Values)
- Operator chose to reorient their Elevator Pitch specifically
- Composed by new-orientation.md or reorientation.md
</when-to-use>

<steps>

<step name="frame_the_exercise" priority="first">
<if condition="previous orientation exists">
> Your previous pitch was:
> *"{previous pitch}"*
</if>

> Your foundation so far:
> - **Deep Why:** {statement}
> - **North Star:** {metric}
> - **Values:** {v1}, {v2}, {v3}, {v4}, {v5}
>
> An elevator pitch has 4 floors. Each floor is one sentence:
>
> **Floor 1** — Who you are (identity, not job title)
> **Floor 2** — What you do (the work, in plain language)
> **Floor 3** — Why it matters (the impact)
> **Floor 4** — What's next (the vision or the ask)
>
> Let's build each floor. Don't try to be clever — try to be clear.
</step>

<step name="floor_1">
> **Floor 1: Who are you?**
>
> Not your job title. Not your company. If you met someone at a party and they asked "what are you about?" — what's the one-sentence answer?

**Wait for response.**
</step>

<step name="floor_2">
Reflect Floor 1 back, then:

> **Floor 2: What do you do?**
>
> The work itself. What does your day look like when it's going well? One sentence.

**Wait for response.**
</step>

<step name="floor_3">
Reflect Floor 2 back, then:

> **Floor 3: Why does it matter?**
>
> Who benefits and how? This connects to your Deep Why. One sentence.

**Wait for response.**
</step>

<step name="floor_4">
Reflect Floor 3 back, then:

> **Floor 4: What's next?**
>
> Where is this going? What's the thing you're building toward? This connects to your North Star. One sentence.

**Wait for response.**
</step>

<step name="assemble_and_refine">
Assemble the full pitch from all 4 floors. Read it as one continuous statement.

> ## Your Elevator Pitch
>
> *"{floor1} {floor2} {floor3} {floor4}"*
>
> Read it out loud. Does it sound like you?
>
> **[1] That's me — lock it in**
> **[2] Reword a floor** — tell me which one
> **[3] Start over** — the whole thing feels off

**Wait for response.**
</step>

<step name="lock">
Elevator Pitch is locked.

Return to parent workflow with:
- `pitch`: full assembled pitch
- `floors`: object with floor_1 through floor_4
- `completed_at`: current ISO date

This phase is complete. Parent workflow resumes.
</step>

</steps>

<output>
Elevator Pitch data: 4 floors + assembled pitch, ready for operator.json.
</output>

<acceptance-criteria>
- [ ] Each floor answered individually by operator
- [ ] Full pitch reads as one coherent 30-second statement
- [ ] Floor 3 connects to Deep Why
- [ ] Floor 4 connects to North Star
- [ ] Operator confirmed it sounds like them
</acceptance-criteria>
