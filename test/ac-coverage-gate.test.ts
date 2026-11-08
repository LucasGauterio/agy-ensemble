import { describe, expect, test } from "bun:test"
import {
  generateSharedTestEnvScriptsManifest,
  validateAcceptanceCriteriaTestCoverage,
} from "../src/ac-coverage-gate"

describe("IMP-09 / VAL-09: 3-Layer Test Engineering, Hard AC Coverage Gate & Shared Test Scripts", () => {
  test("fails as a blocking Hard Gate when any AC-1..N lacks a mapped test in Tests or Test Specs (Error path)", () => {
    const uncovered = validateAcceptanceCriteriaTestCoverage({
      acceptanceCriteriaIds: ["AC-1", "AC-2", "AC-3"],
      testsTableCoveredAcIds: ["AC-1"],
      testSpecsCoveredAcIds: ["AC-2"],
    })

    expect(uncovered.passed).toBe(false)
    expect(uncovered.uncoveredAcIds).toEqual(["AC-3"])
  })

  test("passes when 100% of AC-1..N are covered across Unit, Integration, and E2E layers and generates shared scripts/test-env/ manifest", () => {
    const covered = validateAcceptanceCriteriaTestCoverage({
      acceptanceCriteriaIds: ["AC-1", "AC-2", "AC-3"],
      testsTableCoveredAcIds: ["AC-1", "AC-2"],
      testSpecsCoveredAcIds: ["AC-2", "AC-3"],
    })

    expect(covered.passed).toBe(true)
    expect(covered.uncoveredAcIds.length).toBe(0)

    const scripts = generateSharedTestEnvScriptsManifest()
    expect(scripts).toContain("scripts/test-env/infra-up.sh")
    expect(scripts).toContain("scripts/test-env/tenant-provision.sh")
    expect(scripts).toContain("scripts/test-env/db-migrate.sh")
    expect(scripts).toContain("scripts/test-env/db-reset.sh")
    expect(scripts).toContain("scripts/test-env/run-suite.sh")
    expect(scripts).toContain("scripts/test-env/run-phase-gate.sh")
  })
})
