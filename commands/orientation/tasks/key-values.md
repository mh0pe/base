<purpose>
Guide the operator through identifying and ranking their top 5 personal values — the core principles they operate by. The constraint of exactly 5 forces prioritization and clarity.
</purpose>

<user-story>
As an operator, I want to be clear on my top 5 operating principles, so that I can make decisions faster and stay aligned when things get chaotic.
</user-story>

<when-to-use>
- Phase 3 of new orientation (after North Star)
- Operator chose to reorient their Key Values specifically
- Composed by new-orientation.md or reorientation.md
</when-to-use>

<steps>

<step name="context_and_brainstorm" priority="first">
<if condition="previous orientation exists">
> Your previous values were:
> 1. {v1} — {meaning1}
> 2. {v2} — {meaning2}
> 3. {v3} — {meaning3}
> 4. {v4} — {meaning4}
> 5. {v5} — {meaning5}
</if>

> Your Deep Why: *"{deep_why_statement}"*
> Your North Star: *"{north_star_metric}"*
>
> Values are the principles you actually operate by — not aspirational ones you wish you had. Think about the last time you made a hard decision. What did you lean on?
>
> Give me 7-10 values that feel true. Don't overthink it — we'll narrow down.

**Wait for response.**
</step>

<step name="gut_check">
Before cutting, reflect each value back with a personalized one-line description based on what you know about the operator. This helps them see what each value actually means to them, not just the word.

> Here's what I'm hearing from you:
>
> 1. **{Value}** — {personalized description based on context}
> 2. **{Value}** — {personalized description}
> ...
>
> Is anything missing that you'd fight for if challenged? Or are these the ones?
>
> **[1] These are the ones — let's cut to 5**
> **[2] I want to add 1-2 more, then cut**

**Wait for response.**
</step>

<step name="narrow_to_five">
Force the cut. ALWAYS show the personalized description alongside each value — never list bare value names.

> Now the hard part — cut to 5. The ones that survive are the ones you'd defend if someone challenged them.
>
> Which ones can you live without? Drop them one at a time until you're at 5.

If operator struggles, offer a forcing question: "If you could only teach your kids 5 principles about how to live, which of these make the cut?"

**Wait for response.**
</step>

<step name="rank">
Present values WITH their descriptions, then ask for ranking:

> 1. **{Value}** — {description}
> 2. **{Value}** — {description}
> ...
>
> Now rank them 1-5. #1 is the one that wins when two values conflict.

**Wait for response.**
</step>

<step name="add_meaning">
For each value in ranked order:

> **{Value #N}: {value name}**
> In one sentence — what does this look like in practice for you? Not the dictionary definition. How does this value show up in your daily decisions?

Iterate through all 5, waiting for each response.

**Wait for each response.**
</step>

<step name="confirm_and_lock">
Present the complete values list:

> ## Your 5 Key Values
>
> 1. **{v1}** — {meaning}
> 2. **{v2}** — {meaning}
> 3. **{v3}** — {meaning}
> 4. **{v4}** — {meaning}
> 5. **{v5}** — {meaning}
>
> **[1] Lock it in**
> **[2] Swap a value**
> **[3] Rerank**
> **[4] Reword a meaning**

**Wait for response.**
</step>

<step name="lock">
Key Values are locked.

Return to parent workflow with:
- `values`: array of 5 objects (rank, value, meaning)
- `completed_at`: current ISO date

This phase is complete. Parent workflow resumes.
</step>

</steps>

<output>
Key Values data: 5 ranked values with practical meanings, ready for operator.json.
</output>

<acceptance-criteria>
- [ ] Started with 7-10 brainstormed values
- [ ] Narrowed to exactly 5
- [ ] Ranked 1-5 with explicit prioritization
- [ ] Each value has a practical meaning (not dictionary definition)
- [ ] Operator approved the final list
</acceptance-criteria>
