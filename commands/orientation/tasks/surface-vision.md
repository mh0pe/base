<purpose>
Guide the operator to conjure 2-5 concrete, tangible future moments that represent what their life looks like when things are working. These are sensory anchors — specific enough to visualize, "superficial" on purpose because the surface is what the inner world connects to.
</purpose>

<user-story>
As an operator, I want tangible anchor points for the future I'm building toward, so that my inner psychology has something concrete to orient around rather than abstract goals.
</user-story>

<when-to-use>
- Phase 5 of new orientation (after Elevator Pitch)
- Operator chose to reorient their Surface Vision specifically
- Composed by new-orientation.md or reorientation.md
</when-to-use>

<steps>

<step name="set_the_frame" priority="first">
<if condition="previous orientation exists">
> Your previous Surface Vision scenes:
> - {scene 1}
> - {scene 2}
> - {scene 3}
> Summary: *"{previous summary}"*
</if>

> Your foundation:
> - **Deep Why:** {statement}
> - **North Star:** {metric}
> - **Values:** {v1}, {v2}, {v3}, {v4}, {v5}
> - **Pitch:** {pitch}
>
> Surface Vision is different from the others. This isn't about metrics or statements. This is about moments.
>
> Close your eyes for a second. Picture your life when the North Star is hit and the Deep Why is being lived daily. Don't think about the business model or the revenue. Think about a single moment in a regular day.
>
> What does one specific moment look like? Be concrete — where are you, what are you doing, what do you see, hear, feel?

**Wait for response.**
</step>

<step name="capture_scenes">
After the first scene:

> Good. That's Scene 1.
>
> Give me another moment. Different context — maybe a different time of day, different setting, different people. Still concrete, still specific.

**Wait for response.**

Continue capturing until operator has 2-5 scenes. After each:

> **[1] Add another scene** (max 5)
> **[2] That's enough — move on**

**Wait for response.**
</step>

<step name="synthesize">
Read back all scenes, then:

> Your scenes:
> 1. {scene 1}
> 2. {scene 2}
> 3. {scene 3}
> ...
>
> What's the thread? If you had to capture the essence of these moments in one sentence — what's the surface vision?

**Wait for response.**

If the summary is too abstract, push: "Make it more concrete. What would a camera capture?"
</step>

<step name="confirm_and_lock">
> ## Your Surface Vision
>
> **Scenes:**
> 1. {scene 1}
> 2. {scene 2}
> 3. {scene 3}
>
> **Summary:** *"{summary}"*
>
> **[1] Lock it in**
> **[2] Add or replace a scene**
> **[3] Reword the summary**

**Wait for response.**
</step>

<step name="lock">
Surface Vision is locked.

Return to parent workflow with:
- `scenes`: array of scene strings
- `summary`: one-sentence synthesis
- `completed_at`: current ISO date

This phase is complete. Parent workflow resumes.
</step>

</steps>

<output>
Surface Vision data: 2-5 scenes + summary sentence, ready for operator.json.
</output>

<acceptance-criteria>
- [ ] At least 2 scenes captured (max 5)
- [ ] Each scene is concrete and sensory, not abstract
- [ ] Summary captures the thread across scenes
- [ ] Operator approved the final vision
</acceptance-criteria>
