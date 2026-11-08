---
name: plan-validate
description: Audits phase context and plans including blocking checks SEC-OBS-LGPD-N (LGPD, Vault, Gitleaks, Logging, OTel) and FINOPS-VIABILITY-N (Cloud TCO vs Value Generated).
---

# `plan-validate` — Etapa 5: Structural, Security, LGPD & FinOps Validation

1. Runs `validatePhasePlanMandateNfr0AndLgpd` (`SEC-OBS-LGPD-1..7`) to block any phase lacking LGPD ROPA, Art. 18 portability/anonymization, Vault Transit encryption + blind index, Consent Ledger, Vault paths, `[LGPD_REDACTED]` structured logging, or OpenTelemetry health probes.
2. Runs `evaluateEconomicViabilityGate` (`FINOPS-VIABILITY-1`) to block overengineered architectures whose monthly Cloud TCO exceeds business value.
