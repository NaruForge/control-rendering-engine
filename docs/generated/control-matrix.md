# OBCM Control Architecture

Generated control-responsibility matrix. Not a compliance or stability assessment.

| Control quantity | Charging | V2G-AC | V2L | V2V | V2H-AC |
| --- | --- | --- | --- | --- | --- |
| Vdc — DC-link voltage | Inverter (regulator) | Inverter (regulator) | CLLC converter (regulator) | CLLC converter (regulator) | CLLC converter (regulator) |
| Iac — AC current | Inverter (unspecified) | Inverter (unspecified) | Inverter (unspecified) | Inverter (unspecified) | Inverter (unspecified) |
| Ibat — Battery current | CLLC converter (unspecified) | CLLC converter (unspecified) | CLLC converter (unspecified) | CLLC converter (unspecified) | CLLC converter (unspecified) |
| Vac — AC voltage | — | — | Inverter (regulator) | Inverter (regulator) | Inverter (regulator) |
| P — Active power | — | CLLC converter (unspecified) | — | — | — |
| Q — Reactive power | — | Inverter (unspecified) | — | — | — |

> Generic, illustrative example. Not an OEM-approved architecture or a statement of compliance.

> Control responsibility does not mean every listed quantity is an independent simultaneous setpoint. Unspecified loop roles remain unspecified.

> Hardware bidirectionality is distinct from the power-flow direction enabled in each operating mode.
