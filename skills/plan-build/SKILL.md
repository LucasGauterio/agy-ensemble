---
name: plan-build
description: Synthesizes Phase A (Tech Specs) and Phase B (Wave Zero SI-NN.0.k + Feature SIs + Dependency Map + Estimates $/ms + Files Touched) without manual pauses.
---

# `plan-build` — Etapa 7: Phase Spec & Wave Zero Synthesis

1. Automatically synthesizes **Wave Zero**:
   - `SI-NN.0.0`: Shared infrastructure (`docker-compose.infra.yml`), Vault/Config Server, Gitleaks, structured JSON logger with `[LGPD_REDACTED]`, OpenTelemetry, LGPD Privacy/Consent/Anonymizer foundation, shared `scripts/test-env/`, and `.github/workflows/`.
   - `SI-NN.0.1`: Code-First Design System tokens and shared UI primitives (`synthesizeWaveZeroDesignSystemStep`).
2. Numbers acceptance criteria `AC-1..N`, includes `Covers AC` in `**Tests:**`, calculates `**Estimates:**` (`estCostUsd`, `estDurationMs`), and lists `**Files touched:**` for `File-Touch Disjointness` verification.
