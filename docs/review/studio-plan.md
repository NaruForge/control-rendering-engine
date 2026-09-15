# Control Studio reconstruction — reviewed plan

2026-09-15. Baseline: 4e36894. Implement and verify with actual screenshots, then merge the validated head.

## Corrections before implementation

- A DSL is not inherently more AI-friendly than YAML. Support both and preserve v1 imports without changing power direction, mode scope or control roles.
- Separate source/AST, semantic model, computed views and layout/scene data. React Flow is the interaction surface. Share SVG primitives and exact routed edges with deterministic export.
- Keep one root package. No database, cloud model provider, extra state-machine library or GLSP service is necessary.
- Implement an actual Langium grammar and source diagnostics. Route all formats through the same semantic validator.
- Implement MCP stdio tools for validation, inspection, tracing, semantic edit proposals, diff and rendering. No arbitrary filesystem writes and no simulated AI chat.
- Retain the minimal ELK feedback priority mapping. Do not introduce node-name exceptions or custom obstacle routing. Arbitrary free-position dragging is excluded because it would invalidate routed edges; source and inspector edits remain supported.
- Use explicit control symbols, ports, input signs, component ownership, first-class views and mathematical labels. Do not infer controller topology, stability or certification from a diagram.

## Acceptance checklist

1. Typed v2 model, referential/port validation, mode inheritance, v1 import, deterministic serialization and semantic diff.
2. Langium .control, YAML/JSON input, source diagnostics and language-service entry point.
3. Overview, power, control and ownership-matrix projections; view filtering/focus; shared scene data.
4. Port-aware ELK, feedback regressions, layout audit, shared SVG primitives, offline mathematical labels, portable SVG.
5. React Flow workbench: file import/save, source editor, explorer, inspector edits, undo/redo, change review, diagnostics, mode/view selection, three themes, fit/1:1/zoom/pan, SVG/PNG export.
6. CLI validate/render/migrate/diff, MCP server and agent skill; official-client stdio integration tests.
7. Windows/Linux clean install, typecheck, tests, build and reproducible generation. Production Chromium captures for overview, control loops, matrix, diagnostics/change review and tablet viewport.
8. Updated README, design decisions, language/model/API documentation, security boundaries and verification report. Remove obsolete UI and temporary preparation workflow before integration.
9. PR review, fixes, passing CI, merge without forcing main, and verification of the merged revision.

## Primary references checked

LikeC4 CONTRIBUTING.md (GitHub connector); https://langium.org/docs/learn/workflow/generate_ast/ ; https://langium.org/docs/learn/workflow/create_validations/ ; https://reactflow.dev/examples/layout/elkjs ; https://reactflow.dev/api-reference/types/node ; https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-priority-direction.html ; https://ts.sdk.modelcontextprotocol.io/ .

## Boundaries

This is a local-first authoring service, not a hosted multi-tenant SaaS or a control simulation/certification engine. All bundled engineering examples are generic or explicitly synthetic. Customer specifications and signal databases are not part of the implementation.
