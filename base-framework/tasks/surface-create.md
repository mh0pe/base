<purpose>
Create a new data surface through guided conversation. Generates: JSON data file, injection hook, workspace.json registration, and settings.json hook entry. The user answers questions; Claude generates everything.
</purpose>

<user-story>
As an AI builder, I want to create custom data surfaces so Claude has structured, passive awareness of any domain I track — without manually wiring JSON files, hooks, and config.
</user-story>

<when-to-use>
- /base:surface create {name}
- "create a surface", "add a new surface", "I want to track X"
- User wants structured data with hook injection and MCP access
</when-to-use>

<context>
@.base/hooks/_template.py
@.base/workspace.json
</context>

<steps>

<step name="define" priority="first">
## Step 1: Define

Extract surface name from args or ask: "What should this surface be called? (lowercase, no spaces)"

**Validate:**
1. Name is lowercase, alphanumeric + hyphens only
2. Not already registered in workspace.json surfaces section
3. No reserved names: "active", "backlog", "psmm", "staging"

Ask: "What does this surface track? (one sentence)"
→ This becomes the `description` in workspace.json.

**Wait for response before proceeding.**
</step>

<step name="schema">
## Step 2: Schema

Ask: "What fields does each item need?"

Guide through these decisions (one at a time):

1. **Required fields** — What must every item have?
   - Default minimum: `["title"]`
   - Common additions: status, priority, category, assignee, due_date

2. **ID prefix** — Auto-suggest first 3 chars of name, uppercase.
   - e.g., surface "clients" → prefix "CLI"
   - User can override

3. **Priority/status enums** — If the surface has priority or status fields:
   - Ask: "What priority levels?" (e.g., high, medium, low)
   - Ask: "What status values?" (e.g., active, pending, done)

4. **Time rules** (optional) — If the surface benefits from review-by dates:
   - Ask: "Should items have review-by deadlines? If so, how many days per priority level?"
   - Default: none

Build the schema object from answers:
```json
{
  "id_prefix": "CLI",
  "required_fields": ["title", "status"],
  "priority_levels": ["high", "medium", "low"],
  "status_values": ["active", "pending", "done"]
}
```

**Wait for response before proceeding.**
</step>

<step name="injection">
## Step 3: Injection

Ask: "How should items appear in Claude's context each prompt?"

Guide through:

1. **Grouping** — How to organize items in the injection?
   - By priority (default) | By status | By date | Flat (no grouping)

2. **Summary format** — What fields to show per line?
   - Default: `- [ID] Title (status)`
   - Can add: priority tag, due date, custom field

3. **Staleness thresholds** — Days before an item is flagged STALE per priority:
   - Suggest defaults based on priority levels from Step 2
   - e.g., high: 5d, medium: 10d, low: 30d
   - User can adjust

4. **Behavioral mode:**
   - Silent (default) — passive awareness, respond only when asked
   - Proactive — mention items unprompted (rare, use for critical surfaces)
   - Threshold — stay silent unless deadline/staleness threshold crossed

**Wait for response before proceeding.**
</step>

<step name="tools">
## Step 4: Tools (Informational)

Inform the user:

"All 7 BASE MCP tools work automatically with your new surface:
- `base_list_surfaces` — see all surfaces
- `base_get_surface("{name}")` — read all items
- `base_get_item("{name}", id)` — get specific item
- `base_add_item("{name}", data)` — add new item (validates required fields, auto-generates ID)
- `base_update_item("{name}", id, data)` — update fields (resets staleness clock)
- `base_archive_item("{name}", id)` — move to archived
- `base_search(query, "{name}")` — search items

No configuration needed — BASE MCP auto-discovers surfaces from workspace.json."

**Continue to generation.**
</step>

<step name="generate" priority="critical">
## Step 5: Generate

Create all artifacts:

**1. Data file:** `.base/data/{name}.json`
```json
{
  "surface": "{name}",
  "version": 1,
  "last_modified": "{timestamp}",
  "items": [],
  "archived": []
}
```

**2. Hook file:** `.base/hooks/{name}-hook.py`
- Read `.base/hooks/_template.py` as the starting point
- Customize SURFACE_NAME, grouping logic, summary format, staleness thresholds, behavioral directive
- Use the injection decisions from Step 3
- Include `from datetime import date` for staleness calculation
- Follow the _template.py contract exactly

**3. Registration:** Add to `.base/workspace.json` surfaces section:
```json
"{name}": {
  "file": "data/{name}.json",
  "description": "{description from Step 1}",
  "hook": true,
  "silent": true,
  "schema": { ...schema from Step 2... }
}
```

**4. Hook registration:** Add to `.claude/settings.json` UserPromptSubmit hooks:
```json
{
  "type": "command",
  "command": "python3 {absolute_workspace_path}/.base/hooks/{name}-hook.py"
}
```
Use absolute path resolved from workspace root.

**5. Report:**
```
Surface "{name}" created:
  Data:     .base/data/{name}.json (empty, ready for items)
  Hook:     .base/hooks/{name}-hook.py (will inject next prompt)
  Schema:   {id_prefix}-NNN, {required_fields}
  Tools:    base_get_item("{name}", id), base_add_item("{name}", data), etc.

Add your first item: base_add_item("{name}", {title: "..."})
```
</step>

</steps>

<verification>
After generation:
- [ ] .base/data/{name}.json exists and is valid JSON
- [ ] .base/hooks/{name}-hook.py exists and parses as valid Python
- [ ] workspace.json has the surface registration
- [ ] settings.json has the hook entry with absolute path
- [ ] Hook outputs correct XML when piped test input
</verification>
