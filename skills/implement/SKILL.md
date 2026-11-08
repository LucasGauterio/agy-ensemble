---
name: implement
description: Worker execution protocol for a single Step Implementation (SI-NN.X) inside an isolated worktree and multi-tenant container environment.
---

# `implement` — Teammate SI Execution Protocol

1. Claim assigned task via `ensembleClaim`.
2. Read `SI Context Pack` (`library-refs.md`, `gotchas.md`, acceptance criteria `AC-1..N`).
3. Implement architectural code and 3-layer tests inside the isolated tenant schema (`s_si_nn_x`), adhering strictly to Mandate `NFR-0` and LGPD compliance.
4. Execute `run-suite.sh`, Semgrep SAST, and Gitleaks pre-commit check.
5. Send `<si-report>` (including `<friction-and-learnings>`) to `lead` via `ensembleMessage` and mark task complete via `ensembleTasksComplete`.
