/**
 * Evaluate the Combined Quality Gate consuming native test framework reports
 * (JUnit XML / CTRF JSON + LCOV / coverage-summary.json) AND SonarQube/SonarCloud metrics.
 */
export function evaluateCombinedQualityGate(input: {
  ctrfReport: { total: number; passed: number; failed: number; skipped: number; retries: number }
  coverageSummary: { linesPct: number; branchesPct: number }
  sonarMetrics: {
    reliabilityRating: string
    securityRating: string
    maintainabilityRating: string
    newCoveragePct: number
    newDuplicationsPct: number
  }
}): { passed: boolean; reasons: string[] } {
  const reasons: string[] = []

  if (input.ctrfReport.failed > 0) {
    reasons.push(`Test failures detected in native CTRF/JUnit report: ${input.ctrfReport.failed} failed.`)
  }
  if (input.ctrfReport.skipped > 0) {
    reasons.push(`Skipped tests are forbidden by agy-ensemble Quality Gate (${input.ctrfReport.skipped} skipped).`)
  }
  if (input.coverageSummary.linesPct < 80 || input.coverageSummary.branchesPct < 80) {
    reasons.push(
      `Insufficient LCOV coverage: lines=${input.coverageSummary.linesPct}%, branches=${input.coverageSummary.branchesPct}% (minimum 80% required).`,
    )
  }
  if (
    input.sonarMetrics.reliabilityRating !== "A" ||
    input.sonarMetrics.securityRating !== "A" ||
    input.sonarMetrics.maintainabilityRating !== "A"
  ) {
    reasons.push("Sonar Quality Gate rating below 'A' on Reliability, Security, or Maintainability.")
  }
  if (input.sonarMetrics.newCoveragePct < 80) {
    reasons.push(`Sonar coverage on new code (${input.sonarMetrics.newCoveragePct}%) is below 80%.`)
  }
  if (input.sonarMetrics.newDuplicationsPct >= 3) {
    reasons.push(`Sonar duplicated lines on new code (${input.sonarMetrics.newDuplicationsPct}%) exceeds 3% limit.`)
  }

  return {
    passed: reasons.length === 0,
    reasons,
  }
}
