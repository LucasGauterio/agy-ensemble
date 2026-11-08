---
name: init-project
description: Executes Etapa 0.0 (Brownfield & Codebase-Doc Sync Blocking Gate) and Etapa 1.0 (Iterative Assumption Interview & Synthesis of the Consolidated Official Request).
---

# `init-project` — Etapa 0.0 (Brownfield Gate) & Etapa 1.0 (Assumption Interview)

1. **Etapa 0.0 (Blocking Brownfield Gate):**
   - Call `evaluateBrownfieldGate(projectDir)`.
   - If the repository has existing code and any mandatory artifact is missing or out of sync (`driftCount > 0`), immediately run `bootstrapAndSyncBrownfieldProject(projectDir)` to scan 100% of the codebase, generate retroactive planning (`docs/project-plan.md`, `docs/phases/phase-01-baseline/`, `PRD.md`, `RFC.md`, `FDD.md`, `DESIGN_SYSTEM.md`, `adrs/`) and populate `progress.md`, `docs/TRACKER.md`, and `docs/VALIDATION.md` before accepting new feature work.
2. **Etapa 1.0 (Iterative Assumption Interview):**
   - Detect all open assumptions (`detectOpenAssumptions`).
   - Ask 3–5 multiple-choice questions per `ask_question` call (1st option prefixed with `(Recommended) `) in a loop until zero assumptions remain.
   - Generate the `Requisição Consolidada Oficial` (`synthesizeConsolidatedOfficialRequest`), replacing the user's raw initial prompt.
