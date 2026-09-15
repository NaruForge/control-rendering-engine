# Reviewed delivery checklist

Reference: [pre-implementation plan](studio-plan.md). Date: 2026-09-15. Merge and final check references are recorded on [PR #2](https://github.com/NaruForge/control-rendering-engine/pull/2).

| Planned boundary | Delivered and checked |
| --- | --- |
| v2 semantic model and legacy compatibility | Strict domain schema, reference/port/sign checks, nested/branched components, explicit modes, v1 fixtures and parity tests |
| Actual language frontends | Generated Langium grammar/AST, .control and YAML/JSON parity, source ranges, single-document stdio LSP |
| First-class views | Overview, power, control, matrix, include/focus/mode/grouped projections; omitted-boundary notes |
| Shared scene and rendering | ELK port geometry, normalized nested coordinate frames, common SVG node/edge primitives consumed by React Flow and export; offline math glyphs |
| Authoring workbench | CodeMirror, explorer/inspector, semantic transactions, undo/redo, change review, diagnostics, block/connection/view creation, themes, viewport controls |
| AI/CLI adapters | Eight actual MCP tools, schema resource and skill, bounded proposals without filesystem writes, standalone CLI and stdio launchers |
| Verification | 53 core tests on three OS/Node combinations; actual MCP/LSP transports; production-browser authoring/export tests and 14 screenshots |
| Documentation/security | README and model/language/architecture/AI/security guides, generation commands, explicit limitations, reviewed transitive security patch |
| Repository hygiene | Original v1 YAML preserved; obsolete renderer/UI removed; generated text artifacts checked; temporary tooling absent; final CI read-only |

## Plan changes retained deliberately

YAML remains first-class rather than being deprecated by an unproven DSL advantage. No provider-specific LLM SDK, persistence backend, GLSP or extra state library was added. Semantic editing is supported, while arbitrary node dragging is intentionally disabled because it would invalidate the shared routes. Full project-wide LSP imports/rename and a published VS Code extension are not claimed. Examples are generic/synthetic; their attractive appearance is not engineering approval.

The final merge is gated on the exact PR head passing all four checks, followed by verifying main. This record describes delivered scope; the PR merge event is the authoritative integration record.
