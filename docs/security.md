# Security and engineering boundaries

The web workbench compiles in a local worker. Opening/editing a source file does not send it to a server, persist it in browser storage, or automatically change a Git working tree. Bundled examples are public and generic. No remote fonts, telemetry or hosted AI SDK are used. Dependency installation still requires npm access; do not confuse offline model processing with an offline initial installation.

The dev and preview servers bind to loopback by default. This is not a hardened multi-tenant web service. Do not expose a development server or MCP stdio endpoint to untrusted users. A static build can be hosted using an approved internal server, with access controls supplied by that environment.

All model labels become escaped SVG text. No model-provided HTML, `foreignObject`, image URL, executable expression or raw SVG is accepted. Mathematical expressions use restricted local base/AMS MathJax packages with a length/buffer limit; link/HTML/autoload commands are disallowed. Exported math consists of glyph paths. CLI screenshot/PDF export disables page JavaScript and blocks all network requests.

Source, element counts, hierarchy depth, alias expansion, operation count and render-output size are bounded. No control-language `eval` exists. The MCP server does not accept file paths or URLs as a substitute for source text and never writes files. CLI output paths are explicitly user-selected local destinations. CSV strings that could begin spreadsheet formulas are neutralized.

The optional source language has stable generated grammar and source diagnostics. JSON Schema is a structural interchange aid, not a substitute for compiler reference checks. Test suites validate declared data relationships and geometry, not physical feasibility, units algebra, regulator stability, safety timing, anti-islanding or compliance. Do not treat a clean layout audit, green CI or `NOT_REVIEWED` CSV as engineering approval.

Versioned schema and source files are intended for Git review. `.private/` and local suffix files are ignored, but Git ignore does not prevent deliberate staging, screenshots, copied text or tool uploads. Review every public commit and screenshot. No customer specification or CAN database belongs in this repository.
