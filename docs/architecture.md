# Architecture

The model stores meaning; the view compiler stores presentation. `parseModel → validateModel → resolve modes → render` is shared by the browser and CLI. SVG does not contain executable model code or a hidden copy of the complete YAML.

## Why hybrid layout

A serial power path has an intentional reading order. Asking a graph solver to place headings, mode cards and control ownership tables makes the composition unstable. `render.ts` therefore lays these elements out with deterministic dimensions. Only the general signal graph invokes ELK. `layout.ts` returns geometry, not SVG; the presentation layer applies the same design tokens to that geometry.

The framework uses vanilla TypeScript for the workbench rather than React because there is no component-tree requirement here. SVG remains the rendering boundary; a React integration can consume the same `render()` API later without changing the model.

## Extension points

A new domain quantity normally changes YAML only. A new visual theme changes `theme.ts`. A new independent diagram family should add a named view with an explicit projection of the same resolved model. A branching power-network model requires a schema version and a new layout contract; do not pretend the current serial template supports it by bending source order.

## Determinism and security

The lockfile controls dependency versions. ELK uses a fixed seed. Generated SVG contains no timestamps, external assets, scripts or `foreignObject`. Input limits and strict schema checks reject ambiguous models. YAML aliases have an expansion limit. CSV export neutralizes spreadsheet formula prefixes. Browser edits stay in memory and can be explicitly downloaded.

No claim is made that different operating-system fonts produce pixel-identical PNG/PDF files. SVG geometry is deterministic for an unchanged model, renderer and dependency set; rasterized appearance also depends on fonts and browser versions.

## Boundaries

Reference validity and selected declarative constraints are machine checked. Energy balance, control bandwidth, loop arbitration, state-transition safety, implementation timing and standard conformance are not inferred or verified. Those belong to engineering evidence and a separately specified validation workflow.

## Primary references

- ELK layered: https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
- Port constraints: https://eclipse.dev/elk/reference/options/org-eclipse-elk-portConstraints.html
- Zod JSON Schema: https://zod.dev/json-schema
- YAML parsing and alias limits: https://eemeli.org/yaml/
- Vite: https://vite.dev/guide/
- Playwright: https://playwright.dev/docs/intro
