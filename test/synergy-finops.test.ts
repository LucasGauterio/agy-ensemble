import { describe, expect, test } from "bun:test"
import {
  evaluateEconomicViabilityGate,
  evaluateStackSynergyAndVolumetry,
} from "../src/synergy-finops-validator"

describe("IMP-06 / VAL-06: Stack Synergy Engine, 3-Tier Volumetry & FINOPS-VIABILITY-N Gate", () => {
  test("computes Stack Synergy Score, models 3 volumetry tiers (Seed/Growth/Scale), and passes viable Cloud TCO", () => {
    const result = evaluateStackSynergyAndVolumetry({
      stack: ["Next.js", "NestJS", "PostgreSQL", "Redis", "Vault"],
      cloudTarget: "gcp-cloudflare-github",
      expectedMonthlyBusinessValueUsd: 2500,
      seedMonthlyCostUsd: 18,
      growthMonthlyCostUsd: 165,
      scaleMonthlyCostUsd: 890,
    })

    expect(result.decisionStatus).toBe("DECIDED")
    expect(result.synergyScore).toBeGreaterThanOrEqual(85)
    expect(result.tiers.seed.monthlyCostUsd).toBe(18)
    expect(result.tiers.growth.monthlyCostUsd).toBe(165)
    expect(result.tiers.scale.monthlyCostUsd).toBe(890)
  })

  test("blocks overengineered architecture via FINOPS-VIABILITY-N when monthly Cloud TCO exceeds economic value generated (Error path)", () => {
    const check = evaluateEconomicViabilityGate({
      architectureDescription: "Multi-region Kubernetes + 5 dedicated Kafka clusters for an internal 50-user app",
      estimatedMonthlyCloudCostUsd: 3800,
      expectedMonthlyValueGeneratedUsd: 400,
    })

    expect(check.viable).toBe(false)
    expect(check.issueId).toBe("FINOPS-VIABILITY-1")
    expect(check.simplerAlternativeRecommendation).toContain("Cloud Run")
  })
})
