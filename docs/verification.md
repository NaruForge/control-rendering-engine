# Verified baseline — 2026-09-15

Verified code/configuration commit: `435bcca1c0bee7dcc980f3fc40c5ec87644578cb`.

[GitHub Actions run — all four jobs passed](https://github.com/NaruForge/control-rendering-engine/actions/runs/34942238683)

| Environment | Completed checks |
| --- | --- |
| Windows runner / Node 24 | Clean `npm ci`, 26 tests, TypeScript check, Vite production build, all committed text projections regenerated without a diff |
| Ubuntu runner / Node 24 | Same core checks |
| Ubuntu runner / Node 22.16.0 | Same core checks at the declared minimum Node version |
| Ubuntu / Playwright Chromium | Live YAML editing, invalid-model handling, view/theme switching, SVG and PNG downloads, ELK graph rendering, tablet-size screenshot, CLI PNG and PDF exports |

The OBCM architecture, signal-workbench screenshot and exported one-page PDF were visually inspected. This is a review of the supplied examples, not a claim that every possible model size or label combination is visually verified.

The browser smoke exercises the Vite development server. Production bundling is checked separately. macOS, Safari, Firefox and physical Android devices were not executed in this baseline. Browser/raster/PDF typography depends on installed fonts; only SVG geometry/text projections are checked for deterministic regeneration.

The temporary bootstrap workflow generated and committed the real npm lockfile, JSON Schema and public sample renders. It has been removed. The permanent CI has read-only repository permissions, and never commits generated changes.

This test suite validates software behavior and selected declarative model constraints. It does not validate an OBCM's control stability, independent-setpoint feasibility, transition safety, standard conformance or certification. The generated CSV is explicitly an unreviewed checklist, not passed engineering evidence.
