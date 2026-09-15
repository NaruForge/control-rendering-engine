# MCP and AI authoring

## Configuration

```sh
npm ci
npm run mcp:config
```

The configuration command prints an MCP `mcpServers` entry using the actual Node executable and absolute `scripts/mcp.mjs` path. Add that entry to a compatible client. The launcher resolves its loader from this repository, independent of the client's working directory. The official SDK stdio client is exercised in tests from a different working directory.

No API key, remote agent or model SDK is needed. The user chooses their own coding-agent provider and permissions. `Agent tools` in the browser explains the integration; it is not a fake chat widget or a claim that this webapp itself runs a language model.

## Tools

| Tool | Input / result |
| --- | --- |
| validate_model | Source text → diagnostics, revision, format and migration flag |
| list_views | Source → view definitions and modes |
| inspect_element | Source, collection, ID → element, source span, explicit relations |
| trace_signal | Source, block, direction, depth, feedback flag → nodes/edges/boundaries |
| get_control_owners | Source and optional quantity → resolved mode assignments |
| render_view | Source, view, optional mode/theme → SVG, size, audit, optional scene |
| compare_models | Before/after source → semantic changes, including inherited effects |
| propose_operations | Source, expected revision, typed operations → validated proposed source and diff |

Each tool is a pure local computation with read-only and closed-world annotations. No method reads arbitrary files, writes files, fetches URLs, publishes or executes shell commands. Render results are capped at 4 MiB. A malformed request receives an error, not a partially saved model. For large architectures, request a narrower view.

Resource: `control://schema/v2`. Prompt: `edit-control-architecture`. Exact operation schemas are in `schema/operations.schema.json`. Reusable skill: `.agents/skills/control-authoring/SKILL.md`.

## Example semantic proposal

First call `validate_model` and use the returned revision. The source field below must contain the entire current model, not the filename.

```json
{
  "source": "<entire current model>",
  "expectedRevision": "<revision from validate_model>",
  "operations": [
    {"op":"assign_control","mode":"v2g","component":"inverter","quantity":"q","role":"unspecified"}
  ]
}
```

The returned source is a proposal. Review its semantic diff and generated diagram before applying it with your agent's filesystem tool. Comments and formatting are normalized; no lossless roundtrip claim is made. Revision tokens are deterministic stale-edit guards, not cryptographic signatures.
