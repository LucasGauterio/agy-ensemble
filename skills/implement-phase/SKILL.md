---
name: implement-phase
description: Stage 8–10 Multi-Agent DAG Orchestrator (delegate: true, 1 Fresh Teammate per SI in Workspace 'share'), Quality/Security Gate auditor, and Stage 10 Self-Learning Loop.
---

# `implement-phase` — Etapas 8, 9 e 10: Multi-Agent DAG Execution & Self-Learning

1. **Pre-Flight Check:** Verify `evaluateBrownfieldGate(projectDir).canStartNewWork === true`.
2. **Stage 8 (Multi-Agent DAG Execution):**
   - Call `ensembleImportPhasePlan` to populate `team_task` and verify `File-Touch Disjointness`.
   - For each unblocked `SI-NN.X`, call `TenantProvisioner.provisionTenant` (`s_si_nn_x`, `u_si_nn_x`, Redis ACL, RabbitMQ vhost, ephemeral Vault token) and `ensembleSpawn` (`Workspace: 'share'`).
   - Audit `<si-report>` and diff (`auditDiffForLgpdAndSecrets` + `evaluateCombinedQualityGate`).
   - Call `ensembleShutdown` (preserving `ensemble/preserved/{team}/{name}` and revoking Vault token) and `ensembleMerge`.
3. **Stage 9 (Phase Quality & Security Gate):**
   - Run `evaluateCombinedQualityGate` (Sonar Rating `A`, LCOV `>= 80%`, `0 skipped`) and `evaluateOffensiveDefensiveSecurityGate` (Semgrep, Trivy, OWASP ZAP/Nuclei, and `worker-pentest-nn`).
4. **Stage 10 (Autonomous Retrospective, FinOps Closeout & Self-Evolution):**
   - Run `calculatePhaseFinOpsSummary`, `updateCostTimeCalibration`, and `processStage10ContinuousLearning`.
