---
name: control-authoring
description: Inspect, edit and validate Control Studio models and generate architecture and control-block diagrams without inventing engineering facts.
---

# Control Studio authoring

Read `docs/model.md`, `docs/language.md` and `schema/model.schema.json` before changing a model. The canonical interchange IR is schema v2; `.control`, YAML and JSON are equivalent frontends. Stable IDs, explicit ports, explicit input signs, component ownership and first-class views are authoritative. View coordinates are derived, not facts to embed in source.

## Available actual MCP tools

`validate_model`, `list_views`, `inspect_element`, `trace_signal`, `get_control_owners`, `render_view`, `compare_models`, `propose_operations`.

Launch `node /absolute/path/to/control-rendering-engine/scripts/mcp.mjs`. Generate your exact client configuration with `npm run mcp:config`. Tools accept source text; they do not browse files, execute commands, call an AI provider, persist edits or push Git commits.

## Workflow

1. Read the source through your approved filesystem tooling. Validate it. Record `revision` and diagnostics.
2. Query affected elements/modes/ports. A visible view is only a projection; check omitted boundary connections before modifying a subset.
3. Call `propose_operations` with `source`, `expectedRevision` and up to 32 typed operations. Supported: label, assign_control, remove_control, set_flow, set_math, add_block, connect, disconnect, add_view. Review `schema/operations.schema.json` for exact fields.
4. Inspect the returned semantic diff, including inherited mode effects. A component control list replaces the whole inherited list. The operation API preserves siblings, unlike manually replacing a YAML list.
5. Validate and render affected views. Inspect geometric audit and the actual SVG/PNG. Do not infer stability, compliance or causality from visual neatness.
6. Apply the returned source with your filesystem tool only after approval. Semantic operations canonicalize text and discard comments; preserve the old source in version control. Commit model and generated view changes together where repository policy requires it.

## Constraints

Do not infer missing power directions, feedback signs, loop hierarchy, regulation ownership, priority, ratings, timestamps or engineering approval. A feedback edge is a return relation, not proof of negative feedback. Unspecified roles remain unspecified. Use an explicit conversion block for differing quantity declarations. A port has one driver; use a declared sum for multiple inputs.

Model revisions are deterministic stale-edit tokens, not cryptographic signatures. An invalid proposal returns an error and never changes stored source. No MCP method can save, publish, deploy or merge changes.
