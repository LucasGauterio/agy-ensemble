# Matriz Oficial de Implementação (`IMP-00..17`), Validação (`VAL-00..17`) e Bateria de Projetos-Piloto (`E2E-P0..P4`)

Este documento governa a implementação e verificação empírica da skill/plugin **`agy-ensemble`**.

## 1. Itens de Implementação e Validações Automatizadas (`34/34 Testes Passando — 355 Assertions`)

| ID | Item de Implementação | Módulo / Artefato Alvo | Validação Executável (`VAL-*`) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`IMP-00`** | Gate Bloqueante Brownfield & Sincronia Codebase ↔ Documentação (`Etapa 0.0`) | `src/brownfield-gate.ts`, `SKILL.md`, `skills/init-project/SKILL.md` | **`VAL-00`**: `test/brownfield-gate.test.ts` (3 pass) | `[x] PASS` |
| **`IMP-01`** | Servidor MCP `agy-ensemble` + Banco SQLite WAL Expandido (14+ tools + DAG import) | `src/db.ts`, `src/schema.ts`, `src/mcp-server.ts` | **`VAL-01`**: `test/mcp-server.test.ts` (4 pass) | `[x] PASS` |
| **`IMP-02`** | Provisionador Multi-Tenant & Vault Hook (`s_si_nn_x`, Redis ACL, RabbitMQ, Vault) | `src/tenant-provisioner.ts`, `templates/scripts/test-env/` | **`VAL-02`**: `test/tenant-provisioner.test.ts` (1 pass) | `[x] PASS` |
| **`IMP-03`** | Hooks `PreToolUse`/`PostToolUse` + Trace Collector + Motor FinOps (`$` e `ms` Est. vs Real) | `hooks/hooks.json`, `src/trace-collector.ts`, `src/finops.ts` | **`VAL-03`**: `test/trace-finops.test.ts` (2 pass) | `[x] PASS` |
| **`IMP-04`** | Live Execution Trace Graph UI (Sidecar Aux Pane + SSE Stream + 3 Níveis de Zoom) | `sidecars/trace-graph/`, `src/trace-graph-server.ts` | **`VAL-04`**: `test/trace-graph-ui.test.ts` (1 pass) | `[x] PASS` |
| **`IMP-05`** | Etapa 1.0: Motor de Entrevista Iterativa + Síntese da `Requisição Consolidada Oficial` | `src/interview-engine.ts`, `skills/init-project/SKILL.md` | **`VAL-05`**: `test/interview-engine.test.ts` (1 pass) | `[x] PASS` |
| **`IMP-06`** | `Stack Synergy Engine` + Volumetria 3 Tiers (`Seed/Growth/Scale`) + Gate `FINOPS-VIABILITY-N` | `src/synergy-finops-validator.ts`, `skills/research/SKILL.md` | **`VAL-06`**: `test/synergy-finops.test.ts` (2 pass) | `[x] PASS` |
| **`IMP-07`** | Design System Vivo Code-First (Sem Figma) + Síntese da Onda Zero (`SI-NN.0.k`) | `src/design-system-engine.ts`, `skills/screen-inventory/SKILL.md` | **`VAL-07`**: `test/design-system.test.ts` (1 pass) | `[x] PASS` |
| **`IMP-08`** | Mandato `NFR-0` Automático (Compliance Obrigatório LGPD Lei 13.709/2018 + Vault + Gitleaks + OTel + Pino) | `src/nfr0-lgpd-auditor.ts`, `skills/plan-validate/SKILL.md` | **`VAL-08`**: `test/nfr0-lgpd-auditor.test.ts` (2 pass) | `[x] PASS` |
| **`IMP-09`** | Engenharia de Testes (3 Camadas), Hard Gate `AC-1..N ↔ Teste` e Scripts `scripts/test-env/` | `src/ac-coverage-gate.ts`, `skills/plan-test-specs/SKILL.md` | **`VAL-09`**: `test/ac-coverage-gate.test.ts` (2 pass) | `[x] PASS` |
| **`IMP-10`** | Quality Gate SonarQube/SonarCloud + Parser de Reports Nativos (`JUnit XML`, `CTRF JSON`, `LCOV`) | `src/quality-gate-evaluator.ts`, `templates/sonar-project.properties.template` | **`VAL-10`**: `test/quality-gate.test.ts` (2 pass) | `[x] PASS` |
| **`IMP-11`** | Pipeline Ofensivo e Defensivo (`SAST` Semgrep/Trivy, `DAST` ZAP/Nuclei e `PenTests` Red-Team) | `src/security-gate-evaluator.ts`, `agents/worker-pentest.md` | **`VAL-11`**: `test/security-gate.test.ts` (2 pass) | `[x] PASS` |
| **`IMP-12`** | Relatório Executivo Pós-Planejamento (7.5 → 8) + Orquestrador Multi-Agente (`1 Fresh Spawn por SI`) | `src/executive-report.ts`, `skills/implement-phase/SKILL.md` | **`VAL-12`**: `test/executive-orchestrator.test.ts` (1 pass) | `[x] PASS` |
| **`IMP-13`** | Etapa 10: Loop de Aprendizado Contínuo (`<friction-and-learnings>`) e Auto-Evolução de Regras | `src/learning-loop.ts`, `skills/plan-rule-author/SKILL.md` | **`VAL-13`**: `test/learning-loop.test.ts` (1 pass) | `[x] PASS` |
| **`IMP-14`** | Etapa 11: Publicação Produtiva Cloud (`GitHub Actions First` + `gcloud`/`wrangler`/`aws`/`az` + 3 Manuais) | `src/cloud-release-validator.ts`, `skills/cloud-release/SKILL.md` | **`VAL-14`**: `test/cloud-release.test.ts` (1 pass) | `[x] PASS` |
| **`IMP-15`** | Documentação Oficial Completa (`README.md` de 12 seções cobrindo toda a arquitetura e governança) | `README.md` | **`VAL-15`**: `test/readme-completeness.test.ts` (1 pass) | `[x] PASS` |
| **`IMP-16`** | Port Completo das 27 Skills de Planejamento (>860 KB) + Integração Real de Ferramentas/Resiliência Ensemble | `skills/` (60 arquivos), `src/tools/` (16 arquivos), `src/watchdog.ts`, `src/recovery.ts`, `src/process.ts` | **`VAL-16`**: `test/skills-completeness.test.ts` (3 pass) | `[x] PASS` |
| **`IMP-17`** | Regra Mandatória de Sincronia Contínua do README (`Mandato README-SYNC-0` em Fases, Brownfield e na Skill) | `rules/mandatory-readme-sync.md`, `src/readme-sync-evaluator.ts`, `src/brownfield-gate.ts`, `skills/implement-phase/SKILL.md` | **`VAL-17`**: `test/readme-sync-gate.test.ts` (4 pass) | `[x] PASS` |

## 2. Bateria de Testes End-to-End nos Projetos-Piloto (`E2E-P0..P4`)

| ID | Projeto-Piloto | Escopo Arquitetural | Status |
| :--- | :--- | :--- | :--- |
| **`E2E-P0`** | **Piloto 0 — Onboarding Brownfield** | Código existente sem `docs/` → bloqueio de novas features, engenharia reversa, planejamento retroativo e `TRACKER.md` com `0 drift`. | `[ ] PENDING` |
| **`E2E-P1`** | **Piloto 1 — Simples (Somente UI)** | Frontend (`Next.js/Vite` + Tailwind v4) + Design System Code-First + LGPD Consent UI + Ondas Visuais + Unit/Playwright E2E + Sonar. | `[ ] PENDING` |
| **`E2E-P2`** | **Piloto 2 — Simples (Somente Backend)** | Backend API + Mandato `NFR-0` (ROPA LGPD, Redaction BR, Vault, Pino, OTel) + Unit/Int/Supertest E2E + SAST/DAST/PenTest API. | `[ ] PENDING` |
| **`E2E-P3`** | **Piloto 3 — Moderado (`UI + Cache + Backend`)** | Full-Stack Tipado + Isolamento Redis Multi-Tenant por SI (`si_nn_x:*`) + Expurgo LGPD em Cache + E2E Cross-Layer + PenTest Cache/Rate-Limit. | `[ ] PENDING` |
| **`E2E-P4`** | **Piloto 4 — Complexo (`UI + Cache + Backend + Queue + DB`)** | Isolamento Quádruplo por SI (Postgres Schema + Redis ACL + RabbitMQ VHost + Vault) + Criptografia/Blind Index/Crypto-Shredding LGPD Art. 18 + Outbox/DLQ + Race Condition PenTests + Trace Graph + FinOps Calibration. | `[ ] PENDING` |
