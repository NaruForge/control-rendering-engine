# Agent working agreement

This is a TypeScript engineering-diagram renderer, not an autonomous control-design or compliance engine.

## Source of truth
- Edit `examples/*.yaml` for domain facts, `src/model.ts` for schema/validation, `src/render.ts` for composition, `src/theme.ts` for visual tokens, and `src/layout.ts` for graph geometry.
- Never hand-edit generated SVG, CSV, Markdown, JSON Schema, or lockfile content. Regenerate using the relevant command.
- Do not introduce OEM/confidential documents, CAN databases, unpublished parameters, credentials, remote fonts, or telemetry.
- Preserve direction, mode scope, control ownership, units and unknowns. Do not infer V2H isolation, reverse absorption, independent setpoints, cascade loops, or compliance.
- Synthetic examples must explicitly say they are synthetic.

## Implementation
- Core modules must work in browser and Node. Keep filesystem access in the CLI.
- All user-controlled SVG/HTML/Markdown text must be escaped. Never evaluate YAML as code.
- Keep output deterministic: stable ordering, fixed seeds, no timestamps, no random SVG IDs.
- A child `controls.<stage>` replaces that stage's list. `[]` deliberately clears it. Never silently union lists.
- Retain a single root package. Add no Docker, service, database, agent provider or framework unless the change actually requires it.

## Minimum sufficient verification
- Documentation-only: check links and command consistency. Do not run browsers.
- Model/schema/renderer changes: `npm run typecheck`, `npm test`; regenerate affected outputs.
- Workbench/export changes: also build and run browser smoke. Install Chromium only when these tests are needed.
- Inspect at least one actual rendered result for layout changes; text-only tests cannot establish visual quality.
- Explain what was tested and what was not. Never label a review checklist as passed engineering tests.
- Do not run unrelated applications, containers, paid models or external providers to validate this repository.
