# Verification — reconstruction candidate

Baseline: `4e36894`. Implementation work is on `refactor/control-studio`; the reviewed acceptance plan is `docs/review/studio-plan.md`.

## Local checks completed

Node 22.16: actual Langium generation, TypeScript typecheck, 53 tests, production bundling, generated schema and all bundled views. Tests include real official-SDK MCP stdio communication (from a different cwd), real LSP wire messages, CLI filesystem integration, v1 migration parity, format roundtrips, transactions, graph projections, nested ELK coordinates, feedback endpoints/signs, deterministic scene/export, math restrictions and geometric audit.

The local browser environment blocks navigations, so intermediate UI styling was inspected with an offline development harness. That is not counted as production browser verification. The unchanged production bundle is exercised on a GitHub Actions runner before integration. The development harness is not part of the repository.

## Required merge gate

Windows/Node 24 and Ubuntu/Node 24/22.16 clean install + `npm run check` + deterministic generation, and the Production Chromium authoring/export job must all pass. Read actual captured overview, control diagram, matrix, source diagnostics, semantic review and tablet views. A generated artifact or screenshot file existing is not sufficient proof of layout quality.

The production test checks source editing and recovery, inspector operations, undo/redo, JSON-compatible source roundtrips, shared compiler/export equality, mode-specific power arrows, three themes, portable math, block creation, port connection, view creation, native zoom/pan and viewport-invariant exports. It records `test-results/verification.json` and screenshots in the CI artifact. CLI PNG/PDF outputs are included.

## Limits

The result is a local-first authoring service. No physical Android/iPad, macOS, Safari or Firefox execution is claimed. The browser suite emulates a 768 px viewport in desktop Chromium. Font appearance remains environment dependent. All tests are software/structural checks; they do not approve control design, dynamics, timing or standards compliance.

The development preparation/transfer workflows are temporary branch tooling and are absent from the final implementation tree. Permanent CI has read-only repository permissions and does not mutate source. No customer specifications, credentials, external font files or dependency folders are included.
