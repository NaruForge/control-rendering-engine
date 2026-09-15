# Control Studio: agent working agreement

This repository is a model-first control-diagram authoring service. It is NOT a control simulator, stability prover, or certification engine.

## Architecture and authority

- Authoring sources: `examples/*.control`, v2 YAML/JSON, or approved private files. Keep v1 `.yaml` examples as migration fixtures.
- Semantic contracts: `src/domain`; source parsing/serialization/views: `src/compiler`; Langium grammar: `src/language/control.langium`.
- Layout is ELK geometry in `src/layout`; portable scene/SVG in `src/scene`. React Flow `src/workbench` MUST use the same scene and primitives. Never introduce a second UI-only edge router or silently drag nodes away from exported geometry.
- MCP `src/agent/server.ts`, LSP `src/language/server.ts`, CLI `src/cli/main.ts` are adapters, not separate business logic.
- Do not edit `src/language/generated`, `schema`, `syntax`, or `docs/generated` manually. Use `npm run language:generate` and `npm run generate`.
- Retain one root package. Add an infrastructure service, backend database or hosted AI dependency only when an accepted requirement actually needs one.

## Engineering facts

Preserve power directions, mode scopes, independent unknowns, port directions, declared quantities, input signs and control ownership. Dashed feedback does NOT imply a negative sum sign. Do not infer loop bandwidth, priority, measurement location, grid/island state, V2H absorption or standard compliance.

Control assignment lists replace inherited lists per component. Resolve the inherited list before editing, retain sibling quantities and inspect affected descendant modes. An exclusive regulator constraint is structural, not an energy-balance or control-stability proof.

Synthetic examples must say so. Do not add OEM specifications, CAN databases, customer parameters, credentials or proprietary inputs to this public repository. Keep private inputs in `.private/`; ignoring files is not a substitute for reviewing staged changes.

## AI workflow

Read `.agents/skills/control-authoring/SKILL.md`. Use the MCP tools or CLI to inspect, propose a bounded semantic transaction, validate, render and compare. MCP tools do not write files. Apply returned source only after review. Semantic edits normalize formatting/comments; never claim a lossless text edit. Revision tokens detect stale models, not malicious modification.

## Tests and review

- Documentation-only: inspect links/commands; no browser run unless relevant.
- Model/parser/view/scene changes: `npm run language:generate`, `npm run typecheck`, `npm test`, `npm run generate`.
- UI/export changes: also `npm run test:browser` with Playwright Chromium. Read the actual screenshots; existence tests cannot establish visual quality.
- `npm run check` runs generation, typecheck, tests and production bundling. Tests include actual MCP and LSP stdio clients.
- Keep output deterministic, source limits enforced, text escaped and math restricted/offline. No remote fonts, telemetry or user-model auto-upload.
- Do not commit dependency folders, raster proof images, dev harnesses or temporary preparation workflows. Permanent CI is read-only and must fail when generated files drift.
- Report what was actually run, and distinguish browser viewport emulation from physical-device testing. Never mark the review CSV as passed engineering tests.
