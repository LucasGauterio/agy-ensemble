import { describe, expect, test } from "bun:test"
import { createDb } from "../src/db"
import { ensembleCreate } from "../src/mcp-server"
import {
  evaluatePreToolUseHook,
  recordActionSpanComplete,
  recordActionSpanStart,
} from "../src/trace-collector"
import {
  calculatePhaseFinOpsSummary,
  estimateActionCostAndDuration,
  updateCostTimeCalibration,
} from "../src/finops"

describe("IMP-03 / VAL-03: Lifecycle Hooks, Trace Collector & FinOps Engine", () => {
  test("blocks sub-subagent spawning from teammates and blocks git commit --no-verify (Error paths)", () => {
    const subagentCheck = evaluatePreToolUseHook({
      callerRole: "teammate",
      toolName: "invoke_subagent",
      commandLine: "",
    })
    expect(subagentCheck.allowed).toBe(false)
    expect(subagentCheck.reason).toMatch(/Sub-agent isolation/)

    const noVerifyCheck = evaluatePreToolUseHook({
      callerRole: "teammate",
      toolName: "run_command",
      commandLine: "git commit -m 'feat: bypass' --no-verify",
    })
    expect(noVerifyCheck.allowed).toBe(false)
    expect(noVerifyCheck.reason).toMatch(/Gitleaks bypass forbidden/)
  })

  test("records trace spans with estimated and actual monetary cost ($) and duration (ms) and recalibrates FinOps multipliers", () => {
    const db = createDb(":memory:")
    const team = ensembleCreate(db, { name: "finops-team", leadSessionId: "lead-1" })

    const est = estimateActionCostAndDuration(db, {
      category: "backend-si",
      baseCostUsd: 0.2,
      baseDurationMs: 60000,
    })
    expect(est.estCostUsd).toBe(0.2)
    expect(est.estDurationMs).toBe(60000)

    const span = recordActionSpanStart(db, {
      teamId: team.id,
      zoomLevel: 3,
      nodeKind: "TOOL_CALL",
      label: "Execute SI-01.1 Tests",
      agentName: "worker-si-01-1",
      siId: "SI-01.1",
      estCostUsd: est.estCostUsd,
      estDurationMs: est.estDurationMs,
    })

    const finished = recordActionSpanComplete(db, {
      spanId: span.id,
      status: "completed",
      inputTokens: 12000,
      outputTokens: 3000,
      actualCostUsd: 0.24,
      actualDurationMs: 72000,
    })

    expect(finished.actualCostUsd).toBe(0.24)
    expect(finished.actualDurationMs).toBe(72000)

    const summary = calculatePhaseFinOpsSummary(db, team.id)
    expect(summary.totalEstCostUsd).toBeCloseTo(0.2, 4)
    expect(summary.totalActualCostUsd).toBeCloseTo(0.24, 4)
    expect(summary.totalEstDurationMs).toBe(60000)
    expect(summary.totalActualDurationMs).toBe(72000)

    // Calibrate future estimates based on observed actual vs estimated ratio
    const cal = updateCostTimeCalibration(db, {
      category: "backend-si",
      estCostUsd: 0.2,
      actualCostUsd: 0.3,
      estDurationMs: 60000,
      actualDurationMs: 90000,
    })
    expect(cal.costMultiplier).toBeGreaterThan(1.0)
    expect(cal.durationMultiplier).toBeGreaterThan(1.0)
  })
})
