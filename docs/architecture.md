# Architecture — Control Studio 0.2

The architecture is a compiler with multiple adapters, not a canvas database.

```text
.control / YAML / JSON
          │
    Parse + source spans       Langium grammar / YAML frontend
          │
     Semantic Model            strict v2 schema, linking and validation
          │
      Computed View            include / focus / mode / ownership groups
          │
     Layout + Scene            ELK geometry + measured SVG primitives
          ├───────────────┐
          ▼               ▼
   React Flow viewer   deterministic SVG / PNG / PDF
          ▲
          │ same compiler and operations
    CLI / MCP / LSP
```

## Boundaries

`domain/` contains model types, declarative checks, graph queries, atomic edit operations and semantic diff. `compiler/` parses input, resolves legacy imports, serializes v2 and computes views. `language/` contains the actual Langium grammar and generated AST/parser metadata; the LSP adapter shares the same semantic validator as other frontends. A standalone single-document LSP provides diagnostics, completion, symbols, definition lookup, hover and canonical formatting. Multi-file imports, rename refactoring and a published VS Code extension are not implemented.

`layout/` adapts a ComputedView to ELK and normalizes hierarchical coordinate frames. Explicit ports have fixed positions. Edge `container` can name an enclosing graph even when ELK stores the edge in a root array; coordinates must be resolved against that container. Feedback direction priority is 0 versus 1 for ordinary signals: a soft cycle-breaking preference, not an execution priority or universal order guarantee.

`scene/` is a JSON-compatible portable representation containing measured nodes, routes, labels, groups, glyph paths and source references. `nodeMarkup()` and `edgeMarkup()` are shared by React Flow and exported SVG. React Flow supplies interaction, focus, selection, handles and the viewport. It does not recompute graph layout. Free node dragging is deliberately disabled: preserving exact routes between independent renderers is more important than a misleading manual editor. Add-block, connect, disconnect, inspector edits, source edits and computed views ARE implemented.

The worker in `workbench/` performs parsing, projection, math and layout off the UI thread. Request IDs discard stale responses. The main UI keeps undo/redo source snapshots in memory. No localStorage, database or remote persistence is used. Explicit source downloads are the persistence boundary. A valid old diagram is never presented as the current result of invalid source.

## AI and language design decisions

The earlier claim that a new DSL is inherently better for AI than YAML was too strong. Both are first-class inputs. The language's actual advantages here are explicit domain words, source spans and language tooling, not a supposed universal model preference. The system uses real Langium generation, not a regular-expression pseudo-parser. Typed MCP operations avoid asking an agent to manipulate SVG coordinates. Tools return validated proposals and never write arbitrary files.

MCP uses the stable v1 TypeScript SDK, rather than the upstream v2 alpha branch. Launchers resolve the TS runtime relative to their own repository, so the MCP caller need not use this directory as its working directory. No provider SDK or fake chatbot is included.

MathJax 3.2.2 is a deliberately pinned, offline base/AMS-to-SVG adapter. It is not advertised as the latest MathJax release. Only glyph paths are emitted; external HTML, href, autoload and runtime font downloads are absent. Static exports use the same expression geometry as the UI.

## Determinism and limits

Fixed input order, lockfile, ELK seed and canonical source serialization make repeated output deterministic for the same environment. There are no generated timestamps. System-font metrics and browser rasterization differ across platforms; byte-identical raster output is not claimed. Tests compare structural scene/SVG output and actual screenshots, not a universal visual-optimality score.

Limits: 128 KiB source, 128 control blocks, 256 signals, eight component hierarchy levels, 32 views/modes and 256-character restricted math expressions. These are safety bounds, not a readability guarantee for maximal graphs. Large systems should use filtered views and explicit boundary notes.

This service checks syntax, references, port direction, quantity identity, duplicate drivers, declared regulator exclusivity and selected geometric constraints. It does not prove unit algebra, energy balance, stable control, fault safety, timing or standards compliance.

## Primary design references

- LikeC4 separation of core/language/views/layout/diagram: https://github.com/likec4/likec4/blob/main/CONTRIBUTING.md
- Langium workflow: https://langium.org/docs/learn/workflow/generate_ast/
- React Flow ELK example: https://reactflow.dev/examples/layout/elkjs
- ELK priority direction: https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-priority-direction.html
- MCP TypeScript SDK: https://ts.sdk.modelcontextprotocol.io/
