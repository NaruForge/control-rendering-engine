# Verification — Control Studio 0.2

2026-09-15. Reconstruction of baseline `4e36894`. Reviewed plan: [studio-plan](review/studio-plan.md). Integration record and the final head/merged-main checks: [PR #2](https://github.com/NaruForge/control-rendering-engine/pull/2).

## Executed verification

[Production candidate run 34960298054](https://github.com/NaruForge/control-rendering-engine/actions/runs/34960298054) passed all four jobs at `2d47505`. This is the actual production bundle, not a development harness.

| Environment | Executed checks |
| --- | --- |
| Windows / Node 24 | Clean npm ci, actual Langium generation, TypeScript check, 53 tests, Vite production build, reproducible generated artifacts |
| Ubuntu / Node 24 | Same core checks |
| Ubuntu / Node 22.16.0 | Same checks at the declared minimum version |
| Production Chromium 153.0.8010.12 | 22 recorded UI/export checks, 14 actual screenshots, CLI PNG and one-page PDF export |

Core tests include an official-SDK MCP stdio client launched from a different cwd, real LSP wire messages, CLI filesystem integration, v1 migration parity, YAML/JSON/DSL roundtrips, atomic operations, stale revisions, view projections, nested ELK coordinate frames, feedback ports and input signs, deterministic scene/SVG, restricted math and structural layout audit.

The production browser suite exercises overview/matrix/mode views, inspector edits, undo/redo, semantic diff, real CodeMirror error diagnostics and recovery, invalid-source export blocking, source-format roundtrips, three themes, vector math, nested and branched models, block addition, declared-port connection and view authoring. Browser SVG is compared with the Node compiler output, not merely checked for existence. It also checks Fit/1:1/pan at 768 px, export invariance to viewport, PNG signatures, no uncaught browser exceptions and no non-local network requests.

## Visual inspection

Actual screenshots were opened and read for the overview, cascaded control diagram, matrix, source/inspector, change review, source diagnostics, nested control, branched power, symbol library and tablet native-size viewport. Forward signal reading order, feedback destinations and explicit minus signs are legible in the cascade view. Ownership grouping is a separate projection and may change reading order; it is not advertised as globally optimal layout.

The CI artifact `control-studio-verification` contains the screenshots, `test-results/verification.json`, exported SVG/PNG/PDF, audit JSON and production bundle. Artifacts are retained for 14 days; the same commands regenerate them. Proof screenshots are not hand-designed mockups or committed binary source.

## Defects found and corrected before integration

- Nested ELK edges can be stored in the root edge array while using another container's coordinates. Normalize against each edge's declared coordinate frame.
- Importing ELK's bundled in-process UMD implementation from the compiler Web Worker conflicts with its message channel. Browser layouts now use a dedicated ELK worker; Node CLI/MCP use the in-process backend. Production tests caught this defect even when the core tests and build passed.
- The status bar now distinguishes a valid semantic model from a successfully rendered current view; it does not report an unavailable view as up to date.
- The dependency audit found a transitive `@xmldom/xmldom` version pinned by speech-rule-engine. A reviewed override to 0.9.12 and regenerated npm lockfile replace that version without broad dependency upgrades. [Patch validation](https://github.com/NaruForge/control-rendering-engine/actions/runs/34960710884) passed npm ci, audit high-severity gate, all core tests/build and unchanged generated output. Final PR/main CI repeats the production suite and retains the current audit report.

## Review and limits

Temporary preparation, transfer, dependency-repair and startup-probe tooling is removed from the integration tree. Permanent CI has read-only repository permissions and does not mutate source. No customer specifications, credentials, external font files or dependency folders are included.

No physical Android/iPad, macOS, Safari or Firefox execution is claimed. A 768 px Chromium viewport is an emulation. System-font appearance remains environment dependent. This is a local-first authoring service, not a multi-tenant hosted service, LLM chatbot, simulator or certification tool. All tests are software/structural checks; they do not approve control design, stability, timing, units algebra, energy balance or standards compliance.
