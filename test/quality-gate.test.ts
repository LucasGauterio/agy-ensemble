import { describe, expect, test } from "bun:test";
import { evaluateCombinedQualityGate } from "../src/quality-gate-evaluator";

describe("IMP-10 / VAL-10: SonarQube Quality Gate & Native Test Framework Reports (JUnit, CTRF, LCOV)", () => {
	test("blocks merge when native test report has skipped tests or branch/line coverage < 80% or Sonar Gate fails (Error paths)", () => {
		const failedBySkipped = evaluateCombinedQualityGate({
			ctrfReport: { total: 15, passed: 14, failed: 0, skipped: 1, retries: 0 },
			coverageSummary: { linesPct: 88, branchesPct: 85 },
			sonarMetrics: {
				reliabilityRating: "A",
				securityRating: "A",
				maintainabilityRating: "A",
				newCoveragePct: 86,
				newDuplicationsPct: 1.2,
			},
		});
		expect(failedBySkipped.passed).toBe(false);
		expect(failedBySkipped.reasons[0]).toMatch(/Skipped tests are forbidden/);

		const failedByCoverage = evaluateCombinedQualityGate({
			ctrfReport: { total: 15, passed: 15, failed: 0, skipped: 0, retries: 0 },
			coverageSummary: { linesPct: 74, branchesPct: 68 },
			sonarMetrics: {
				reliabilityRating: "A",
				securityRating: "A",
				maintainabilityRating: "A",
				newCoveragePct: 74,
				newDuplicationsPct: 1.2,
			},
		});
		expect(failedByCoverage.passed).toBe(false);
		expect(failedByCoverage.reasons.some((r) => r.includes("coverage"))).toBe(
			true,
		);
	});

	test("passes when native framework reports (JUnit/CTRF + LCOV) and Sonar Quality Gate meet all Clean-as-You-Code thresholds", () => {
		const ok = evaluateCombinedQualityGate({
			ctrfReport: { total: 42, passed: 42, failed: 0, skipped: 0, retries: 0 },
			coverageSummary: { linesPct: 91.5, branchesPct: 84.2 },
			sonarMetrics: {
				reliabilityRating: "A",
				securityRating: "A",
				maintainabilityRating: "A",
				newCoveragePct: 89.4,
				newDuplicationsPct: 0.8,
			},
		});
		expect(ok.passed).toBe(true);
		expect(ok.reasons.length).toBe(0);
	});
});
