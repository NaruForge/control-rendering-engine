# Feedback rendering and viewport

## Minimal layout change

`signals.edges[].kind` already distinguishes ordinary signals and feedback. The layout adapter now maps that field to ELK's `elk.layered.priority.direction`: ordinary signals = 1, feedback = 0. This is a soft preference in the cycle-breaking phase, not controller execution priority and not a universal placement guarantee.

No new YAML field, node-name exception, hand-written node coordinates, return-lane allocator or custom obstacle router is introduced. The declared source/target endpoints, port sides and signal directions are unchanged. In the cascade fixture, the forward chain reads left-to-right through the plant and measurement block; the two feedback edges return to their original SOUTH controller ports. The graph becomes wider but lower, rather than forcing the measurement block to the lower-left corner.

Reference: https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-priority-direction.html

## Reading large diagrams

- **Fit** fits both SVG dimensions in the available canvas, and tracks changes when the sidebar or YAML panel is hidden.
- **1:1** means one SVG unit per CSS pixel, independent of browser width; it is not relative to Fit. This scale persists after resizing or re-rendering.
- Slider / +/- controls change actual scale up to 400%. Ctrl/Cmd + wheel zooms around the cursor. Ordinary wheel/trackpad scrolling remains native.
- Drag with a mouse to pan. Touch devices use native two-axis scrolling. Keyboard users can focus the diagram viewport and use normal scroll keys.
- **Sidebar** and **YAML** independently collapse the corresponding panels.

These controls change the viewport only. They do not rewrite the YAML, rerun ELK or change exported SVG geometry. A wide graph cannot be both fully visible and native-size on a small screen; use Fit for orientation and 1:1 plus panning for reading.

## Regression coverage

`tests/feedback.test.ts` checks the supplied fixture's forward ordering, return direction, SOUTH endpoints, orthogonal routes, node-interior avoidance, label/node separation, ID-independent behavior and deterministic feedback styles. These are fixture regressions, not a proof of optimality for arbitrary graphs.

The production-build browser smoke now includes the signal view in all three themes, real native-resolution captures, 768 px Fit/1:1 behavior, resizing, mouse pan, Ctrl+wheel zoom, 400% scale and SVG export invariance. Evidence is stored in the CI artifact, not automatically committed. A screenshot captured at a tablet-sized viewport is not a physical Android-device test.
