# Semantic model v2

All authoring formats compile to the same strict schema in `src/domain/schema.ts`. Generated JSON Schema: `schema/model.schema.json`. Cross references, modes, ports and hierarchy need the compiler in addition to JSON Schema. Version 1 YAML examples remain supported by `src/compiler/migrate.ts`, which first validates the original model and preserves roles, power flow and control scope.

| Collection | Meaning |
| --- | --- |
| quantities | ID, symbol, label, optional unit, optional exclusive regulator flag |
| components | external / converter / bus / subsystem, optional parent and technology |
| powerLinks | explicitly connected leaf components and directional hardware capability |
| modes | group, optional inheritance, complete resolved flow map, per-component control assignments |
| blocks | control symbols, explicit ports, optional component owner/math/mode scope |
| signals | output-port to input-port connections; ordinary or feedback; optional declared quantity |
| views | first-class overview / power / control / matrix with mode/include/focus/grouping |

IDs are stable lowercase ASCII names, 1–64 characters, starting with a letter. `constructor`, `prototype` and `__proto__` are reserved. Labels support Korean and XML-sensitive characters, which are escaped by the renderer.

## Modes and control assignments

Flows are relative to a link's from→to direction: forward, reverse, bidirectional or off. Hardware capability is separate from enabled mode behavior. Every link needs a flow after mode inheritance resolves. A child flow map overrides matching links. A child `controls.<component>` replaces that component's entire list; `[]` intentionally clears it. Other component lists inherit unchanged. A note inherits unless explicitly overridden.

Roles: regulator / inner-loop / command / limit / unspecified. Omitted roles in YAML/JSON default to unspecified. No cascade relation or independent simultaneous setpoint is inferred from a role list. `exclusive: true` prevents two regulator assignments for that quantity in the same mode; it does not require one or validate physical feasibility.

## Control graph

Symbols: reference, controller, sum, gain, integrator, transfer, limiter, plant, measurement, junction, switch. Each block declares at least one port, with stable ID, input/output direction and WEST/EAST/NORTH/SOUTH side. A sign is allowed only on a sum input. Missing sum signs produce a warning, not an inferred minus. A signal connects an output to an input. A single input cannot have two drivers. Fan-out from an output is allowed. Explicit signal/port quantities must refer to the same declared quantity; add a conversion block when quantities differ.

A feedback edge is a diagram relation, not a signed mathematical equation. Ports do not rotate automatically when view direction changes. Owner references associate blocks with existing components. Nested grouping is derived from component ownership; it is a view, not a new set of duplicated blocks.

## Views

Graph view `include` restricts visible elements. Power views accept subsystem IDs and include descendants. `focus` performs bounded graph-neighbourhood projection; omitted boundary connections are counted and disclosed. Mode filtering excludes blocks scoped to other modes and their connections. Control blocks with an empty mode scope are available in all modes. Overview compares mode groups; matrix can compare all modes or use a mode override.

Overview cards are curated presentation, while power/control graphs use ELK. A branching power network is supported in v2; v1's serial path restriction is retained only in the legacy validator. A flat or grouped view uses the same semantic facts.

## Editing contract

Operations in `schema/operations.schema.json` return a newly validated source transaction and semantic diff. No files are written. Intermediate assignments may temporarily conflict within a transaction; validation applies to the completed transaction. Stale revisions are rejected when an expected revision is supplied (required by MCP). Canonical serialization is NOT lossless: comments and formatting are normalized. The UI keeps the previous source for Undo.

Repeated model IDs, endpoints, hierarchy cycles, mode cycles, missing references and illegal scalar declarations are errors, not silently repaired. Canonical IR removes undefined optional properties, so DSL/YAML/JSON roundtrips have the same semantic representation.
