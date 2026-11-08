---
name: agy-ensemble
description: Unified autonomous multi-agent workflow and team orchestration skill for Google Antigravity (AGY). Combines documentation-first phased engineering (Etapa 0.0 Brownfield Gate through Etapa 11 Cloud Release) with parallel multi-agent execution (1 Fresh Teammate Spawn per SI in Workspace 'share'), multi-tenant container & Vault isolation, mandatory Brazilian LGPD compliance (Lei 13.709/2018), SAST/DAST/PenTests, Sonar Quality Gate, FinOps tracking, and Live Execution Trace Graph UI.
---

# `/agy-ensemble` — Unified Autonomous Multi-Agent Engineering Workflow

## Execution Mandate: 100% Autonomous Continuous Mode (`Etapa 0.0` → `Etapa 11`)

When invoked on any project or request, the Lead Agent (Maestro) executes the unified pipeline end-to-end with **strict `delegate: true`** (the Lead never writes `src/**` or `test/**` directly; every Step Implementation `SI-NN.X` is executed by a dedicated fresh Teammate in `Workspace: 'share'`).

### Mandatory Pipeline Stages

1. **Etapa 0.0 — Gate Bloqueante de Sincronia Codebase ↔ Documentação e Bootstrap Brownfield (`src/brownfield-gate.ts`):**
   - If the project already contains implemented code (`src/`, `app/`, `packages/`), inspect whether all workflow artifacts exist (`AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/project-plan.md`, `docs/PRD.md`, `docs/RFC.md`, `docs/FDD.md`, `docs/DESIGN_SYSTEM.md`, `docs/adrs/`, `docs/phases/phase-01..K/{phase-*.md, progress.md}`, `docs/TRACKER.md`, `docs/VALIDATION.md`) and have `0 drift` with the codebase.
   - **Hard Rule:** Never start new work if documentation is missing or out of sync with the codebase. Run `bootstrapAndSyncBrownfieldProject` (reverse codebase analysis + retroactive planning + progress/tracker population) first until `driftCount === 0`.

2. **Etapa 1.0 — Entrevista Iterativa de Presunções & Síntese da `Requisição Consolidada Oficial` (`src/interview-engine.ts`):**
   - Identify all open assumptions (`detectOpenAssumptions`).
   - Run iterative `ask_question` rounds (3–5 questions per turn, 1st option always prefixed with `(Recommended) `) until 100% of assumptions are resolved.
   - Synthesize the **`Requisição Consolidada Oficial`** (`synthesizeConsolidatedOfficialRequest`), which **replaces the raw initial user prompt** as the sole source of truth for all downstream stages.

3. **Etapa 2 — `/research` (`Stack Synergy Engine` + Volumetria 3 Tiers + Viabilidade Econômica + Mandato `NFR-0`):**
   - Evaluate technology choices using `evaluateStackSynergyAndVolumetry` (Seed / Growth / Scale tiers and Cloud OpEx/TCO).
   - Automatically fill `**Decision:**` (never leave `_[pending]_`).
   - Enforce Mandate `NFR-0` including **mandatory Brazilian LGPD compliance (Lei nº 13.709/2018)** regardless of whether the user asked for it.

4. **Etapa 3 — `/design-docs-*` & Code-First Design System (`PRD.md`, `RFC.md`, `FDD.md`, `DESIGN_SYSTEM.md`, `ADRs`):**
   - Update living product, architecture, and functional specs, including the **LGPD ROPA Table** (Finalidade, Base Legal Art. 7º/11, Minimização Art. 6º, Retenção/TTL Art. 15/16, Direitos do Titular Art. 18).
   - Classify UI components in Code-First mode without requiring Figma URLs (`buildCodeFirstScreenInventory`).

5. **Etapas 4, 5 e 6 — `/plan-context`, `/plan-validate` (`SEC-OBS-LGPD-N` & `FINOPS-VIABILITY-N`) e `/plan-resolve` (Context7):**
   - Validate the phase context against `validatePhasePlanMandateNfr0AndLgpd` and `evaluateEconomicViabilityGate`.
   - Resolve all gaps architecturally using official library documentation via Context7 (`library-refs.md`).

6. **Etapa 7 & 7.5 — `/plan-build` (Onda Zero + Estimates `$`/Tempo) & `/plan-test-specs` (Hard AC Gate + Abuse Cases):**
   - Synthesize **Wave Zero** (`SI-NN.0.0` for Infra/Vault/Gitleaks/Logger/OTel/LGPD Foundation and `SI-NN.0.1` for Code-First Design System).
   - Estimate monetary cost (`$`) and time (`ms`) for every action/SI (`estimateActionCostAndDuration`).
   - Enforce 100% `AC-1..N ↔ Test` coverage (`validateAcceptanceCriteriaTestCoverage`) across `Unit`, `Integration`, and `E2E` layers plus `SAST`, `DAST`, and `PenTest` specs.
   - Emit the **Relatório Executivo de Planejamento** (`generatePreExecutionExecutiveReport`) before starting Stage 8.

7. **Etapa 8 — Execução Multi-Agente em Ondas no DAG (`ensembleImportPhasePlan` + `1 Fresh Spawn por SI`):**
   - Import the phase DAG (`ensembleImportPhasePlan`, checking `File-Touch Disjointness`).
   - For each unblocked `SI-NN.X`, provision isolated multi-tenant credentials and Vault token (`TenantProvisioner.provisionTenant`), spawn a fresh Teammate in `Workspace: 'share'` (`ensembleSpawn`), audit its `<si-report>` and diff (`auditDiffForLgpdAndSecrets`), preserve its branch and shut down (`ensembleShutdown`), and squash-merge (`ensembleMerge`).

8. **Etapa 9 — Quality Gate Final (`SonarQube` + Native Test Reports + `SAST/DAST/PenTests`) & Tracker Sync:**
   - Verify `evaluateCombinedQualityGate` (JUnit XML, CTRF JSON, LCOV `>= 80%`, `0 skipped`, Sonar Rating `A`) and `evaluateOffensiveDefensiveSecurityGate` (Semgrep, Trivy, OWASP ZAP/Nuclei, and `worker-pentest-nn` testing BOLA/IDOR, Race Conditions, and LGPD post-anonymization zero residue).
   - Update `docs/TRACKER.md` and `docs/VALIDATION.md`.

9. **Etapa 10 — Retrospectiva Autônoma, Fechamento FinOps (`Est. vs Real`) & Auto-Evolução (`src/learning-loop.ts`):**
   - Report final `Actual Cost $ & Time` vs `Estimated Cost $ & Time` (`calculatePhaseFinOpsSummary`) and recalibrate (`updateCostTimeCalibration`).
   - Process `<friction-and-learnings>` into `docs/learnings/KNOWLEDGE_BASE.md`, `docs/testing/gotchas.md`, and `docs/rules/plan-validate/`.

10. **Etapa 11 — Publicação Produtiva Cloud (`GitHub Actions First` + Multi-Cloud + 3 Runbooks):**
    - Always maintain `.github/workflows/ci-quality-gate.yml`, `.github/workflows/cd-production.yml`, `docs/deploy/PRODUCTION_DEPLOY_GUIDE.md`, `docs/deploy/DEPENDENCIES_AND_CREDENTIALS_RUNBOOK.md`, and `docs/testing/USER_TEST_PLAYBOOK.md`.
    - When explicitly authorized by the user, trigger and monitor production deployment via GitHub Actions (`gcloud`, `wrangler`, `gh`, `aws`, `az`).
