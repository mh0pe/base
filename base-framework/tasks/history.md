<purpose>
Show workspace evolution over time. Read ROADMAP.md and present the chronological record of major workspace changes.
</purpose>

<user-story>
As an AI builder, I want to see how my workspace has evolved, so that I can understand the trajectory and make informed decisions about future changes.
</user-story>

<when-to-use>
- When user wants to review workspace history
- Entry point routes here via /base:history
</when-to-use>

<steps>

<step name="read_history" priority="first">
Read and present workspace evolution.

1. Read `.base/ROADMAP.md`
2. Present chronologically: dates, what changed, why
3. Include audit summaries and major groom outcomes
4. If ROADMAP.md is empty or missing: "No history yet. Run /base:audit or /base:groom to start building your workspace timeline."
</step>

</steps>

<output>
Chronological workspace evolution timeline from ROADMAP.md.
</output>

<acceptance-criteria>
- [ ] History presented in clear chronological format
- [ ] Includes both audits and significant groom outcomes
</acceptance-criteria>
