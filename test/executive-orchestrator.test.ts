import { describe, expect, test } from "bun:test"
import {
  assertLeadZeroCodeRule,
  generatePreExecutionExecutiveReport,
} from "../src/executive-report"

describe("IMP-12 / VAL-12: Pre-Execution Executive Report (7.5 -> 8) & Strict Delegate Orchestrator", () => {
  test("generates comprehensive Executive Report before Stage 8 and enforces Lead zero-code rule (delegate: true)", () => {
    const report = generatePreExecutionExecutiveReport({
      phaseId: "Phase-01",
      consolidatedGoal: "Sistema Clínico com Assinaturas e Prontuário LGPD",
      volumetryTiers: { seedUsd: 22, growthUsd: 180, scaleUsd: 920 },
      waves: [
        { waveIndex: 0, siIds: ["SI-01.0.0", "SI-01.0.1"] },
        { waveIndex: 1, siIds: ["SI-01.1", "SI-01.2"] },
      ],
      totalEstCostUsd: 0.85,
      totalEstDurationMs: 240000,
      traceGraphUri: "sidecar://agy-ensemble/trace-graph",
    })

    expect(report).toContain("## Relatório Executivo de Planejamento (Transição Etapa 7.5 → Etapa 8)")
    expect(report).toContain("sidecar://agy-ensemble/trace-graph")
    expect(report).toContain("$0.85")

    // Error path: Lead attempting to write src/** or test/** directly must be blocked
    expect(() =>
      assertLeadZeroCodeRule({
        callerRole: "lead",
        targetFilePath: "src/billing/payment.service.ts",
      }),
    ).toThrow(/Strict delegate: true violation/)

    // Teammate is allowed to write src/** and test/**
    expect(() =>
      assertLeadZeroCodeRule({
        callerRole: "teammate",
        targetFilePath: "src/billing/payment.service.ts",
      }),
    ).not.toThrow()
  })
})
