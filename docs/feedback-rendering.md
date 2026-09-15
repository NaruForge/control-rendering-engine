# Feedback layout in Control Studio

The existing `kind: feedback` relation maps to `elk.layered.priority.direction = 0`; ordinary signals map to 1. It is a soft direction preference during cycle breaking, not a regulator execution priority. There are no special rules keyed to node names and no custom obstacle-routing engine.

Ports have explicit sides and fixed local positions. Summing signs are separate declarations, displayed on the corresponding input. A feedback edge alone does not imply a minus sign. The cascade fixture uses two explicit sum blocks and returns measurement outputs to their SOUTH inputs.

Hierarchical layouts require coordinate-frame normalization using ELK's edge-container information; the renderer and exporter share the resulting absolute scene geometry. The nested-view tests check endpoint alignment, routes, labels and overlap.

The previous hand-written zoom/pan UI has been removed. React Flow now owns the viewport. Model geometry is not rewritten by zoom/pan, and the exported SVG is invariant. Free node dragging is disabled because arbitrary position changes would invalidate ELK routes. Semantic edits, source edits, block creation and declared-port connections are supported and trigger a fresh compilation.

See `tests/scene.test.ts`, `tests/model.test.ts`, and production browser tests for the actual regression coverage. These fixtures do not establish perfect placement for every possible feedback graph.
