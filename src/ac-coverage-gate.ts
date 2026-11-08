/**
 * Validate as a blocking Hard Gate that 100% of acceptance criteria (AC-1..N)
 * are covered by the union of the Tests table and Test Specs.
 */
export function validateAcceptanceCriteriaTestCoverage(input: {
	acceptanceCriteriaIds: string[];
	testsTableCoveredAcIds: string[];
	testSpecsCoveredAcIds: string[];
}): { passed: boolean; uncoveredAcIds: string[] } {
	const coveredSet = new Set([
		...input.testsTableCoveredAcIds,
		...input.testSpecsCoveredAcIds,
	]);

	const uncoveredAcIds = input.acceptanceCriteriaIds.filter(
		(ac) => !coveredSet.has(ac),
	);
	return {
		passed: uncoveredAcIds.length === 0,
		uncoveredAcIds,
	};
}

/**
 * Return the canonical list of shared test environment scripts created in Wave Zero (SI-01.0.0).
 */
export function generateSharedTestEnvScriptsManifest(): string[] {
	return [
		"scripts/test-env/infra-up.sh",
		"scripts/test-env/tenant-provision.sh",
		"scripts/test-env/db-migrate.sh",
		"scripts/test-env/db-reset.sh",
		"scripts/test-env/db-seed.sh",
		"scripts/test-env/run-suite.sh",
		"scripts/test-env/run-phase-gate.sh",
	];
}
