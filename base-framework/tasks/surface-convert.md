<purpose>
Convert an existing @-mentioned markdown file into a structured data surface. Analyzes the markdown structure, proposes a schema, migrates content, and generates all surface artifacts (JSON, hook, registration).
</purpose>

<user-story>
As an AI builder, I want to convert my existing markdown tracking files into structured surfaces so Claude gets cheap passive awareness instead of expensive @-file parsing.
</user-story>

<when-to-use>
- /base:surface convert {file-path}
- "convert this file to a surface", "make this a data surface"
- User has a markdown file they @-mention regularly and wants it structured
</when-to-use>

<context>
@.base/hooks/_template.py
@.base/workspace.json
</context>

<steps>

<step name="read" priority="first">
## Step 1: Read & Analyze

1. Read the specified markdown file completely
2. Detect structure:
   - **Headings** → potential categories or priority groups
   - **Bold labels** (e.g., `**Status:**`) → field names
   - **List items** → individual entries
   - **Checkboxes** → checklist/progress fields
   - **Dates** → timestamp fields
   - **File paths** → location fields
   - **Tables** → structured data (archived items, reference tables)
3. Identify patterns:
   - How many distinct items?
   - What fields recur across items?
   - Are there priority/status groupings?
   - Is there an archived/done section?

Present findings:
```
Detected structure in {file}:
  Items found: {count}
  Sections: {list of heading-based groups}
  Recurring fields: {field names}
  Archived section: {yes/no}
```
</step>

<step name="propose">
## Step 2: Propose Schema

Based on analysis, propose:

1. **Surface name** — infer from filename (e.g., ACTIVE.md → "active")
2. **Schema** — field names, types, required fields, ID prefix
3. **Sample conversion** — show 2-3 items converted to JSON

```
Proposed schema for "{name}":
  ID prefix: {PREFIX}
  Required: {fields}
  Optional: {fields}
  Priority levels: {if detected}

Sample conversion:
  "{heading item}" →
  {
    "id": "PREFIX-001",
    "title": "...",
    "status": "...",
    ...
  }
```

Ask: "Does this schema look right? Adjust anything?"

**Wait for response.**
</step>

<step name="confirm">
## Step 3: Confirm

Apply any user adjustments to the schema. Lock it for generation.

If user is satisfied, confirm:
"Schema locked. I'll generate the surface and migrate {count} items."
</step>

<step name="generate">
## Step 4: Generate Artifacts

Same generation as surface-create Step 5:
- `.base/data/{name}.json` — with migrated items (not empty)
- `.base/hooks/{name}-hook.py` — from _template.py with appropriate grouping
- workspace.json surface registration
- settings.json hook entry

Include staleness detection with sensible defaults based on detected priority levels.
</step>

<step name="migrate">
## Step 5: Migrate Content

Parse every item from the markdown into JSON entries:
- Map heading groups to priority/category fields
- Map bold labels to field values
- Preserve checklists as arrays of {text, done} objects
- Preserve dates in ISO format
- Preserve file paths as location fields
- Map done/closed/archived sections to the archived array

Report:
```
Migration complete:
  Items migrated: {count}
  Archived items: {count}
  Unmapped items: {count, if any — list them}
```

If any items couldn't be auto-mapped, present them for manual resolution.
</step>

<step name="cleanup">
## Step 6: Clean Up

1. Check if the original file is @-referenced in CLAUDE.md
2. If found, offer: "Remove @{file} from CLAUDE.md? The surface hook replaces it."
3. Suggest: "Original file preserved at {path} for reference."

Do NOT delete the original markdown file — the user decides its fate.
</step>

</steps>

<verification>
After conversion:
- [ ] .base/data/{name}.json exists with migrated items
- [ ] Item count matches source markdown
- [ ] .base/hooks/{name}-hook.py exists and produces output
- [ ] workspace.json and settings.json updated
- [ ] Original markdown file is untouched
</verification>
