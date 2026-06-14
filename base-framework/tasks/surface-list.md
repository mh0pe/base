<purpose>
Display all registered data surfaces with item counts, hook status, and staleness summary.
</purpose>

<when-to-use>
- /base:surface list
- "what surfaces exist", "show surfaces", "list surfaces"
</when-to-use>

<steps>

<step name="read_and_display">
## Show Surfaces

1. Call `base_list_surfaces` to get all registered surfaces with item counts
2. For each surface, read the data file to count stale items (items with no `updated` field or `updated` older than threshold)

Display as:

```
Data Surfaces
═══════════════════════════════════════

| Surface | Items | Hook | Description |
|---------|-------|------|-------------|
| active  | 12    | ✓    | Active work items, projects, and tasks |
| backlog | 8     | ✓    | Future work queue, ideas, and deferred tasks |

Total: {count} surfaces, {total_items} items

Create a new surface: /base:surface create {name}
Convert a file:      /base:surface convert {path}
```

If no surfaces registered:
```
No data surfaces registered.
Run /base:surface create {name} to create your first surface.
```
</step>

</steps>
