import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { executeUnifiedWorkflowPilot } from "../../src/pilot-runner"

describe("Section 14.2: End-to-End Benchmark across 4 Pilot Projects + Brownfield (E2E-P0..P4)", () => {
  test("E2E-P0 (Brownfield): blocks new feature on undocumented codebase, runs Etapa 0.0 reverse analysis + retroactive planning + tracker sync (0 drift), then executes Phase 02", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-p0-brownfield-"))
    fs.mkdirSync(path.join(dir, "src", "legacy"), { recursive: true })
    fs.writeFileSync(
      path.join(dir, "src", "legacy", "customer.service.ts"),
      "export class CustomerService { findById(id: string) { return { id } } }\n",
    )

    const res = await executeUnifiedWorkflowPilot({
      projectDir: dir,
      profile: "brownfield-upgrade",
      initialPrompt: "Adicione exportação de dados LGPD Art. 18 ao serviço de clientes.",
    })

    expect(res.etapa00Triggered).toBe(true)
    expect(res.brownfieldDriftAfterSync).toBe(0)
    expect(res.allGatesPassed).toBe(true)
    expect(fs.existsSync(path.join(dir, "docs", "TRACKER.md"))).toBe(true)
    expect(fs.existsSync(path.join(dir, "docs", "VALIDATION.md"))).toBe(true)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  test("E2E-P1 (Simple — UI Only): executes Etapas 0.0->11 with Code-First Design System, LGPD Consent UI, parallel visual waves, Unit + Playwright E2E, and Sonar Gate", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-p1-ui-"))

    const res = await executeUnifiedWorkflowPilot({
      projectDir: dir,
      profile: "simple-ui",
      initialPrompt: "Crie um painel interativo de gestão financeira pessoal com múltiplas telas.",
    })

    expect(res.allGatesPassed).toBe(true)
    expect(res.consolidatedRequestReplacesInitial).toBe(true)
    expect(res.designSystemWaveZeroCreated).toBe(true)
    expect(res.lgpdCompliant).toBe(true)
    expect(res.leadDirectCodeWrites).toBe(0)
    expect(fs.existsSync(path.join(dir, "docs", "DESIGN_SYSTEM.md"))).toBe(true)
    expect(fs.existsSync(path.join(dir, "src", "components", "ui", "lgpd-consent-banner.tsx"))).toBe(true)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  test("E2E-P2 (Simple — Backend Only): executes Etapas 0.0->11 with Mandate NFR-0 (LGPD ROPA, [LGPD_REDACTED] logs, Vault, OTel), Supertest E2E, Sonar Gate, ZAP DAST, and API PenTest", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-p2-backend-"))

    const res = await executeUnifiedWorkflowPilot({
      projectDir: dir,
      profile: "simple-backend",
      initialPrompt: "Crie uma API REST para validação e emissão de contratos digitais.",
    })

    expect(res.allGatesPassed).toBe(true)
    expect(res.lgpdCompliant).toBe(true)
    expect(res.securityGatePassed).toBe(true)
    expect(res.sonarQualityGatePassed).toBe(true)
    expect(fs.existsSync(path.join(dir, "docs", "deploy", "PRODUCTION_DEPLOY_GUIDE.md"))).toBe(true)
    expect(fs.existsSync(path.join(dir, "docs", "deploy", "DEPENDENCIES_AND_CREDENTIALS_RUNBOOK.md"))).toBe(true)
    expect(fs.existsSync(path.join(dir, "docs", "testing", "USER_TEST_PLAYBOOK.md"))).toBe(true)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  test("E2E-P3 (Moderate — UI + Cache + Backend): executes Etapas 0.0->11 with Full-Stack typed contracts, per-SI Redis ACL/prefix isolation, LGPD cache purge, and Rate-Limit/Cache PenTests", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-p3-moderate-"))

    const res = await executeUnifiedWorkflowPilot({
      projectDir: dir,
      profile: "moderate-ui-cache-backend",
      initialPrompt: "Crie um portal de telemedicina com dashboard em tempo real, cache de sessão e rate limiting.",
    })

    expect(res.allGatesPassed).toBe(true)
    expect(res.isolatedTenantsProvisioned).toBeGreaterThanOrEqual(3)
    expect(res.redisPrefixesDisjoint).toBe(true)
    expect(res.lgpdCompliant).toBe(true)
    expect(res.securityGatePassed).toBe(true)

    fs.rmSync(dir, { recursive: true, force: true })
  })

  test("E2E-P4 (Complex — UI + Cache + Backend + Queue + Database across 2 Phases): proves quadruple SI isolation (Postgres + Redis + RabbitMQ + Vault), LGPD Vault Transit encryption + Crypto-Shredding, Race Condition PenTests, Trace Graph UI, and FinOps calibration across Phase 01 -> Phase 02", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-p4-complex-"))

    const res = await executeUnifiedWorkflowPilot({
      projectDir: dir,
      profile: "complex-full-stack-queue-db",
      initialPrompt: "Crie uma plataforma transacional hospitalar multi-clínica com faturamento assíncrono em filas, prontuário PostgreSQL, cache Redis e painel operacional.",
    })

    expect(res.allGatesPassed).toBe(true)
    expect(res.phasesCompleted).toBe(2)
    expect(res.quadrupleIsolationVerified).toBe(true)
    expect(res.lgpdCryptoShreddingVerified).toBe(true)
    expect(res.raceConditionPentestPassed).toBe(true)
    expect(res.traceGraphLevelsPopulated).toEqual([1, 2, 3])
    expect(res.finopsCalibratedAcrossPhases).toBe(true)
    expect(res.stage10PreventiveRulesGenerated).toBeGreaterThanOrEqual(1)

    fs.rmSync(dir, { recursive: true, force: true })
  })
})
