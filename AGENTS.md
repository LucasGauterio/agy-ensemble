# agy-ensemble — Agent Guidelines & Governance

## Overview

`agy-ensemble` is the unified autonomous multi-agent workflow and plugin for Google Antigravity (AGY). It combines:
1. **Documentation-First Autonomous Phased Engineering** (`Etapa 0.0` Brownfield Gate through `Etapa 11` Cloud Release)
2. **Parallel Multi-Agent Team Orchestration** (`delegate: true` by default, 1 Fresh Teammate Spawn per Step Implementation `SI-NN.X`, worktree branch preservation, squash-merge, DAG dependency unblocking)
3. **Multi-Tenant Container & Vault Isolation** (per-SI PostgreSQL schema/user `s_si_nn_x`, Redis ACL/prefix, RabbitMQ vhost, and ephemeral Vault token)
4. **Mandato NFR-0 by Default** (Mandatory Brazilian LGPD Law No. 13.709/2018 compliance, structured JSON logging with Brazilian PII redaction, OWASP zero-trust security, OpenTelemetry, Vault/OpenBao secrets, and 3-layer Gitleaks protection)
5. **Offensive & Defensive Quality Gates** (Unit + Integration + E2E native test reports, SonarQube/SonarCloud Quality Gate, SAST Semgrep/Trivy, DAST OWASP ZAP/Nuclei, and Red-Team `worker-pentest` Business Logic & LGPD PenTests)
6. **Live Execution Trace Graph UI & FinOps Engine** (`sidecar://agy-ensemble/trace-graph` with 3-level semantic zoom, real-time SSE, estimated vs. actual `$` cost and duration tracking, and Stage 10 continuous self-learning)

## Non-Negotiable Invariants

1. **Etapa 0.0 (Brownfield & Codebase-Doc Sync Gate):** Agents MUST NEVER start new feature work on an existing codebase unless all workflow documentation (`docs/PRD.md`, `RFC.md`, `FDD.md`, `DESIGN_SYSTEM.md`, `adrs/`, `project-plan.md`, `phases/phase-01..K/{phase-*.md, progress.md}`, `TRACKER.md`, `VALIDATION.md`) exists and has `0 drift` with the codebase.
2. **Etapa 1.0 (Iterative Assumption Interview & Consolidated Official Request):** When any assumption exists, the Lead MUST run iterative `ask_question` rounds (3-5 questions per call, `(Recommended)` first) until 100% of assumptions are resolved, then synthesize the `Requisição Consolidada Oficial` which replaces the raw initial user prompt.
3. **Mandato NFR-0 & Mandatory LGPD Compliance:** Every application and phase automatically enforces LGPD (ROPA data mapping, legal basis Art. 7/11, Art. 18 data subject rights including portability and irreversible anonymization/crypto-shredding, Vault Transit column encryption + HMAC blind indexing, and `[LGPD_REDACTED]` log masking) regardless of whether the user requested it.
4. **Strict Delegate Mode (`delegate: true`):** The Lead plans, coordinates, audits, and merges; Teammates (`1 Fresh Spawn per SI` in `Workspace: 'share'`) execute 100% of `SI-NN.X` code and test changes.
5. **Mandatory Branch Preservation:** Every code path that shuts down or aborts a Teammate session MUST call `preserveBranch()` (`ensemble/preserved/{team}/{name}`) first.
6. **Code Standards:** TypeScript strict mode, zero `any` types (`noExplicitAny: error`), JSDoc on every exported function, TDD Red/Green/Refactor workflow.
