# Operator Profile Template

Output file: `.base/operator.json`

```template
{
  "version": 1,
  "last_updated": "{iso-date}",
  "hook_active": true,
  "operator": {
    "entity_id": "{apex-entity-id}",
    "name": "{operator-name}"
  },
  "deep_why": {
    "layers": [
      { "level": 1, "question": "Why do you do what you do?", "answer": "[Layer 1 answer]" },
      { "level": 2, "question": "But why does that matter?", "answer": "[Layer 2 answer]" },
      { "level": 3, "question": "But why?", "answer": "[Layer 3 answer]" },
      { "level": 4, "question": "But why?", "answer": "[Layer 4 answer]" },
      { "level": 5, "question": "But why?", "answer": "[Layer 5 answer — the root]" }
    ],
    "statement": "[Synthesized deep why — one sentence distilled from the 5 layers]",
    "completed_at": "{iso-date}"
  },
  "north_star": {
    "metric": "[The key metric or outcome everything aligns toward]",
    "timeframe": "[Target timeframe for this north star]",
    "rationale": "[Why this metric above all others]",
    "completed_at": "{iso-date}"
  },
  "key_values": {
    "values": [
      { "rank": 1, "value": "[Value name]", "meaning": "[What this means to the operator in practice]" },
      { "rank": 2, "value": "[Value name]", "meaning": "[What this means to the operator in practice]" },
      { "rank": 3, "value": "[Value name]", "meaning": "[What this means to the operator in practice]" },
      { "rank": 4, "value": "[Value name]", "meaning": "[What this means to the operator in practice]" },
      { "rank": 5, "value": "[Value name]", "meaning": "[What this means to the operator in practice]" }
    ],
    "completed_at": "{iso-date}"
  },
  "elevator_pitch": {
    "pitch": "[4-floor elevator pitch — who you are, what you do, why it matters, what's next]",
    "floors": {
      "floor_1": "[Who you are]",
      "floor_2": "[What you do]",
      "floor_3": "[Why it matters]",
      "floor_4": "[What's next / the ask / the vision]"
    },
    "completed_at": "{iso-date}"
  },
  "surface_vision": {
    "scenes": [
      "[Concrete future moment — specific, sensory, tangible]",
      "[Another concrete future moment]",
      "[Another concrete future moment]"
    ],
    "summary": "[One sentence that captures the overall surface vision]",
    "completed_at": "{iso-date}"
  },
  "extensions": {}
}
```

## Field Documentation

| Field | Type | Description |
|-------|------|-------------|
| `version` | integer | Schema version for future migrations |
| `last_updated` | ISO date | When any section was last modified |
| `hook_active` | boolean | Controls whether operator hook injects context per prompt |
| `operator.entity_id` | string | Links to Apex entity (e.g., ENT-001) |
| `deep_why.layers` | array | The 5-layer "but why?" excavation |
| `deep_why.statement` | string | Final synthesized deep why |
| `north_star.metric` | string | The one metric/outcome that matters most |
| `north_star.timeframe` | string | When this should be achieved |
| `key_values.values` | array | Ranked top 5, each with practical meaning |
| `elevator_pitch.floors` | object | 4-part structured pitch |
| `surface_vision.scenes` | array | 2-5 concrete future moments |
| `extensions` | object | Open field for future operator metadata |

## Section Specifications

- **deep_why**: All 5 layers must be filled. The statement is a synthesis, not a copy of layer 5.
- **north_star**: Must be measurable or at minimum clearly evaluable. Timeframe is required.
- **key_values**: Exactly 5, ranked. Meaning field captures how the value shows up in daily decisions.
- **elevator_pitch**: Each floor is one sentence max. The full pitch should be speakable in 30 seconds.
- **surface_vision**: Minimum 2 scenes, maximum 5. Must be concrete and sensory, not abstract aspirations.
- **extensions**: Reserved for future operator metadata (e.g., strengths profile, archetype data).
