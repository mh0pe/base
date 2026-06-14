<purpose>
Define the operator's North Star — the one key metric or outcome that everything else aligns toward. Derives from the Deep Why and gives initiatives a measurable target.
</purpose>

<user-story>
As an operator, I want a single guiding metric that tells me whether my work is pointing in the right direction, so that I can evaluate opportunities and say no to misaligned ones.
</user-story>

<when-to-use>
- Phase 2 of new orientation (after Deep Why)
- Operator chose to reorient their North Star specifically
- Composed by new-orientation.md or reorientation.md
</when-to-use>

<steps>

<step name="ground_in_deep_why" priority="first">
<if condition="previous orientation exists">
> Your previous North Star was:
> *"{previous metric}" ({previous timeframe})*
</if>

> Your Deep Why: *"{deep_why_statement}"*
>
> A North Star is the one metric or outcome that, if you achieved it, would mean your Deep Why is being lived. It's not a task. It's not a project. It's the thing that makes all the projects make sense.
>
> What's the one outcome that matters most to you right now? Think in terms of something you could measure or clearly evaluate.

**Wait for response.**
</step>

<step name="refine_metric">
Evaluate the response:

- If too vague ("be successful", "make an impact"): Push for specificity. "What would you point to as proof that's happening?"
- If too narrow ("launch CaseGate"): Push for altitude. "That's a project, not a star. What does completing that project serve?"
- If it's a feeling ("feel free"): Acknowledge it, then ask "What would be true in your life when you feel that? What's the measurable version?"

Once the metric is crisp:

> **Your North Star metric:**
> *"{metric}"*
>
> What timeframe feels right for this? Not a deadline — a horizon. When would you evaluate whether you're on track?
>
> **[1] 6 months**
> **[2] 1 year**
> **[3] 2-3 years**
> **[4] Custom — I'll specify**

**Wait for response.**
</step>

<step name="rationale">
> Last piece — why this metric above all the others you could have chosen? One sentence.

**Wait for response.**
</step>

<step name="confirm_and_lock">
> **Your North Star:**
> *"{metric}"*
> **Timeframe:** {timeframe}
> **Why this one:** {rationale}
>
> **[1] Lock it in**
> **[2] Adjust the metric**
> **[3] Adjust the timeframe**

**Wait for response.**
</step>

<step name="lock">
North Star is locked.

Return to parent workflow with:
- `metric`: the north star metric
- `timeframe`: chosen horizon
- `rationale`: why this metric
- `completed_at`: current ISO date

This phase is complete. Parent workflow resumes.
</step>

</steps>

<output>
North Star data: metric + timeframe + rationale, ready for operator.json.
</output>

<acceptance-criteria>
- [ ] Metric is specific and evaluable (not vague aspiration)
- [ ] Metric connects back to Deep Why
- [ ] Timeframe is set
- [ ] Rationale captured
- [ ] Operator approved the final North Star
</acceptance-criteria>
