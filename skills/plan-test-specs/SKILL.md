---
name: plan-test-specs
description: Mandatory Stage 7.5 blocking Hard Gate enforcing 100% AC-1..N test coverage across Unit, Integration, and E2E layers plus SAST, DAST, and Red-Team PenTest Abuse Cases.
---

# `plan-test-specs` — Etapa 7.5: Blocking AC Coverage Gate & Security Abuse Cases

1. Runs `validateAcceptanceCriteriaTestCoverage` as a **blocking Hard Gate** (`0` uncovered `AC-k` allowed).
2. Generates Abuse Cases for `worker-pentest-nn` (`test/security/phase-NN.pentest.spec.ts`) covering BOLA/IDOR, BFLA, Mass Assignment, Race Conditions (`Promise.all`), and LGPD Art. 18 post-anonymization zero-residue verification.
3. Emits the **Relatório Executivo de Planejamento** (`generatePreExecutionExecutiveReport`) before starting Stage 8.
