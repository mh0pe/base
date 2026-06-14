<purpose>
Excavate the operator's root motivation through a 5-layer "but why?" process. Each layer peels back a surface answer to find the one beneath it, arriving at a foundational Deep Why statement.
</purpose>

<user-story>
As an operator, I want to uncover my deepest motivation for doing what I do, so that my work connects to something real and sustaining rather than external pressure or habit.
</user-story>

<when-to-use>
- Phase 1 of new orientation
- Operator chose to reorient their Deep Why specifically
- Composed by new-orientation.md or reorientation.md
</when-to-use>

<steps>

<step name="setup" priority="first">
<if condition="previous orientation exists">
> Your previous Deep Why was:
> *"{previous statement}"*
>
> We're going to excavate fresh. You can land in the same place or somewhere new. Either is fine.
</if>

> **Layer 1 of 5**
>
> Why do you do what you do? Not the business answer. Not the resume answer. The real one.

**Wait for response.**
</step>

<step name="layer_2">
Reflect back what the operator said in Layer 1 — one sentence, their words not yours.

> You said: "{reflection}"
>
> **Layer 2 of 5**
>
> But why does that matter to you?

**Wait for response.**
</step>

<step name="layer_3">
Reflect back Layer 2.

> You said: "{reflection}"
>
> **Layer 3 of 5**
>
> But why?

If the answer feels surface-level or performative, push: "That sounds like something you'd say to someone else. What's the version you'd say to yourself at 2am?"

**Wait for response.**
</step>

<step name="layer_4">
Reflect back Layer 3.

> You said: "{reflection}"
>
> **Layer 4 of 5**
>
> Why does that drive you more than anything else?

**Wait for response.**
</step>

<step name="layer_5">
Reflect back Layer 4.

> You said: "{reflection}"
>
> **Layer 5 of 5 — the root**
>
> If everything else was stripped away — the business, the tools, the audience — what's left? What's the thing that would still make you get up and build?

**Wait for response.**
</step>

<step name="synthesize">
Now synthesize all 5 layers into a single Deep Why statement.

1. Read back all 5 layers
2. Draft a one-sentence synthesis that captures the root, not just Layer 5 but the thread through all layers
3. Present it:

> Here are your 5 layers:
> 1. {layer 1}
> 2. {layer 2}
> 3. {layer 3}
> 4. {layer 4}
> 5. {layer 5}
>
> **Your Deep Why:**
> *"{synthesized statement}"*
>
> **[1] That's it** — lock it in
> **[2] Close but needs tweaking** — let me adjust the wording
> **[3] Not right** — let me redo a layer

If [2]: Let operator edit the statement directly.
If [3]: Ask which layer to redo, then resume from that layer.

**Wait for response.**
</step>

<step name="lock">
Deep Why is locked.

Return to parent workflow with:
- `layers`: array of 5 layer answers
- `statement`: final approved synthesis
- `completed_at`: current ISO date

This phase is complete. Parent workflow resumes.
</step>

</steps>

<output>
Deep Why data: 5 layers + synthesized statement, ready for operator.json.
</output>

<acceptance-criteria>
- [ ] All 5 layers answered by operator (not generated)
- [ ] Each layer reflected back before asking the next
- [ ] Surface answers challenged when detected
- [ ] Synthesis captures the thread, not just layer 5
- [ ] Operator approved the final statement
</acceptance-criteria>
