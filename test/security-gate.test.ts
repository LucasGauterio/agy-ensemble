import { describe, expect, test } from "bun:test"
import { evaluateOffensiveDefensiveSecurityGate } from "../src/security-gate-evaluator"

describe("IMP-11 / VAL-11: Offensive & Defensive Security Pipeline (SAST, DAST & Red-Team PenTests)", () => {
  test("blocks phase completion when SAST, DAST, or Red-Team PenTest (BOLA, Race Condition, or LGPD Post-Anonymization residue) finds any exploit (Error path)", () => {
    const exploited = evaluateOffensiveDefensiveSecurityGate({
      sastSemgrepErrors: 0,
      scaTrivyCriticalHigh: 0,
      dastZapHighMediumAlerts: 0,
      pentestReport: {
        workerAgent: "worker-pentest-01",
        bolaIdorExploited: false,
        bflaMassAssignmentExploited: false,
        raceConditionDoubleSpendExploited: true,
        lgpdAnonymizationResidueFound: true,
      },
    })

    expect(exploited.passed).toBe(false)
    expect(exploited.remediationRequired).toBe(true)
    expect(exploited.blockingFindings.length).toBe(2)
  })

  test("passes when SAST (Semgrep/Trivy), DAST (OWASP ZAP/Nuclei), and Red-Team PenTests all pass with zero exploits and zero LGPD PII residue", () => {
    const secure = evaluateOffensiveDefensiveSecurityGate({
      sastSemgrepErrors: 0,
      scaTrivyCriticalHigh: 0,
      dastZapHighMediumAlerts: 0,
      pentestReport: {
        workerAgent: "worker-pentest-01",
        bolaIdorExploited: false,
        bflaMassAssignmentExploited: false,
        raceConditionDoubleSpendExploited: false,
        lgpdAnonymizationResidueFound: false,
      },
    })

    expect(secure.passed).toBe(true)
    expect(secure.remediationRequired).toBe(false)
    expect(secure.blockingFindings.length).toBe(0)
  })
})
