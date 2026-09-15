# Model schema v1

Use `schema/model.schema.json` for editor completion. It is generated from the same Zod schema used at runtime. Semantic checks (cross references, inheritance cycles and exclusive regulators) additionally run in `validateModel()`; JSON Schema alone is not sufficient.

| Field | Meaning |
| --- | --- |
| schemaVersion | Exactly `1` |
| title, description | Displayed model identity; no inferred certification |
| groups | Display group IDs and labels; not electrical-state assertions |
| quantities | Stable ID, symbol, label, optional unit and exclusivity declaration |
| stages | Ordered serial power path; external / converter / bus |
| boundary | Optional contiguous subset of power stages |
| links | One explicit from/to link per adjacent stage pair |
| modes | IDs, group, flow map, control assignments, optional parent and note |
| focusQuantity | Quantity whose declared regulator is summarized across modes |
| notes | Human-provided scope and qualifications |
| signals | Optional independent directed graph with explicit nodes, ports and edges |

## Power direction

Link direction is relative to `from → to`, not a P/Q sign convention. `capability` is `forward` or `bidirectional`. A mode's flow map uses `forward`, `reverse`, `bidirectional` or `off`. Every link must have a direction after inheritance resolution. Bidirectional arrows indicate allowed directions, not simultaneous opposite active-power transfer.

## Roles and inheritance

A control assignment is `{ quantity: vdc, role: regulator }`. Supported roles are `regulator`, `inner-loop`, `command`, `limit`, `unspecified`. Omitting role means unspecified. No default cascade relationships are inferred.

`extends` reuses the parent's flow entries and per-stage control lists. Explicit child flow entries override matching links. Explicit child stage lists replace the entire inherited list, not only matching quantities. An empty list clears the stage. IDs, labels and groups remain explicit on the child. The optional note inherits unless overridden. Cycles and unknown parents fail.

`exclusive: true` prevents more than one `regulator` assignment for that quantity in one resolved mode. It does not require a regulator to exist and does not reject multiple limits or prove a physically valid control design.

## Rendering contract and limits

The architecture view is intended for small and medium serial power-conversion systems. General feedback graphs belong in `signals`. Suggested labels are short engineering terms. The parser bounds counts and rejects input over 128 KiB; those limits protect the application, not a promise that a maximal-size model will fit a readable single-page diagram. Split large architectures into views/models rather than reducing text to illegibility.

Identifiers use lowercase ASCII letters, digits, `_` and `-`, start with a letter and have at most 48 characters. Labels can include Korean and XML-sensitive characters; the renderer escapes them. Rendering uses local fonts. Full LaTeX typesetting is not implemented.
