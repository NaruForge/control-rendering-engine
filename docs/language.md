# Control DSL and language service

The grammar is `src/language/control.langium`, compiled by Langium. `.control`, YAML and JSON are equally authoritative frontends; the language is not required for AI integration.

```text
architecture example "Example controller" {
  description "Synthetic example, not a control design recommendation."
  quantity v "V" "Output voltage" unit "V"
  block ref reference "Reference" {
    math "V^*"
    port output out EAST quantity v
  }
  block error sum "Voltage error" {
    port reference in WEST quantity v sign +
    port feedback in SOUTH quantity v sign -
    port output out EAST quantity v
  }
  signal command ref.output -> error.reference label "Vref" quantity v
  view loop control "Control view" { direction RIGHT }
  note "The feedback input is deliberately unconnected until its source is specified."
}
```

Strings are double quoted with JSON-style escapes. Use `\\` inside a string for a TeX backslash. `//` and `/* */` comments are accepted. Optional scalar clauses have a defined order rather than overwriting previous values.

## Declaration forms

```text
quantity id "symbol" "label" [unit "unit"] [exclusive]
component id KIND "label" [technology "description"] [in parent]
power id from -> to forward|bidirectional
mode id "label" group "group" [extends parent] {
  [note "description"]
  flow link forward|reverse|bidirectional|off
  controls component { quantity ROLE ... }
}
block id KIND "label" [owner component] [modes a, b] {
  [detail "description"]
  [math "TeX expression"]
  port id in|out SIDE [quantity q] [sign +|-]
}
signal id block.port -> block.port [label "name"] [feedback] [quantity q]
view id overview|power|control|matrix "title" [mode modeId] {
  [include a, b]
  [focus id depth 2]
  [direction RIGHT|DOWN]
  [grouped]
}
note "qualification"
```

Square brackets above describe optional syntax; they are not literal source tokens. Architecture description, when supplied, is the first item. Block detail precedes math, which precedes ports. View options follow the displayed order. Use `examples/cascade.control` and `examples/branched.control` as runnable examples.

## Tools

`npm run language:generate` refreshes generated AST, grammar metadata and TextMate syntax. `npm run lsp` starts a real stdio Language Server. Clients can use the absolute launcher `node /path/to/repository/scripts/lsp.mjs --stdio`, languageId `control`, file extension `.control`.

Implemented LSP capabilities: full-document synchronization, source-linked syntax/semantic diagnostics, declared-symbol completion, document symbols, definition lookup, plaintext hover and canonical formatting. It is single-document. There is no automatic multi-file import/linking, rename refactoring or packaged VS Code extension. Formatting discards comments, so invoke intentionally and review the result.

The browser CodeMirror editor has syntax highlighting, source diagnostics, declared-symbol completion, search, folding and source history. It talks to a local compilation worker, not a remote LSP process; both routes use the same grammar and semantic validator.
