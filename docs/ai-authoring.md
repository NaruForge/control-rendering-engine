# AI authoring

Start from `examples/obcm.yaml`, `docs/model.md` and `schema/model.schema.json`. The AI modifies facts, not SVG coordinates. A valid diagram is not proof that the facts are correct.

## Reusable prompt

```text
Edit the YAML semantic model for the requested control architecture change.
Read AGENTS.md, docs/model.md and schema/model.schema.json first.
Preserve all facts not explicitly changed. Retain stable IDs and source ordering.
Do not invent power direction, grid/island state, control-loop hierarchy, priority,
parameter values, standard clauses, measurement locations or engineering approval.
Keep unknown roles as unspecified. Add a clearly worded note for an unresolved issue.
Remember: a child controls.<stage> list replaces the inherited list completely.
Do not insert visual coordinates, HTML, SVG, remote URLs or executable code into the model.
Run the minimum applicable validation and regenerate the affected views.
Report the semantic changes separately from presentation changes and test results.
```

## Example request

“Add reactive power responsibility to the V2G inverter only.”

Change the V2G stage's complete control list, retaining existing Vdc/Iac entries and adding Q. Do not add Q to the charging parent. Regenerate the overview, mode view and matrix together. A diff of those views should show one consistent scope change.

No hosted model integration or autonomous editor is built in. Any local or approved AI coding tool can use these text files; no model-provider SDK is needed.
