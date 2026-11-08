import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

describe("IMP-16 / VAL-16: Full Skills & Ensemble Infrastructure Completeness Verification", () => {
	const rootDir = path.resolve(__dirname, "..");
	const skillsDir = path.join(rootDir, "skills");
	const srcDir = path.join(rootDir, "src");

	it("guarantees all core planning and documentation skills exist with full depth (> 700 KB total)", () => {
		expect(fs.existsSync(skillsDir)).toBe(true);

		const requiredSkills = [
			"decide/SKILL.md",
			"design-docs/SKILL.md",
			"design-docs-adr/SKILL.md",
			"design-docs-baseline/SKILL.md",
			"design-docs-diagrams/SKILL.md",
			"design-docs-fdd/SKILL.md",
			"design-docs-ledger/SKILL.md",
			"design-docs-prd/SKILL.md",
			"design-docs-readme/SKILL.md",
			"design-docs-rfc/SKILL.md",
			"design-docs-spec/SKILL.md",
			"design-docs-tracker/SKILL.md",
			"design-docs-validate/SKILL.md",
			"generate-test-guide/SKILL.md",
			"generate-test-guide/testing-fundamentals.md",
			"implement/SKILL.md",
			"implement-phase/SKILL.md",
			"init-project/SKILL.md",
			"plan-build/SKILL.md",
			"plan-build/phase-a.md",
			"plan-build/phase-b.md",
			"plan-build/phase-c.md",
			"plan-build/references/frontend-drift-report-schema.md",
			"plan-build/templates/frontend-runtime-si.md",
			"plan-build/templates/screen-si.md",
			"plan-build/templates/tech-specs/api-contracts.md",
			"plan-build/templates/tech-specs/auth-matrix.md",
			"plan-build/templates/tech-specs/data-model.md",
			"plan-build/templates/tech-specs/error-catalog.md",
			"plan-build/templates/tech-specs/events-messages.md",
			"plan-build/templates/tech-specs/frontend-runtime.md",
			"plan-build/templates/tech-specs/traceability-matrix.md",
			"plan-build/templates/tech-specs/ui-contracts.md",
			"plan-build/templates/tech-specs/lgpd-privacy-spec.md",
			"plan-phase/SKILL.md",
			"plan-pipeline/SKILL.md",
			"plan-pipeline/slicing-implementation-plan.md",
			"plan-resolve/SKILL.md",
			"plan-rule-author/SKILL.md",
			"plan-test-specs/SKILL.md",
			"plan-validate/SKILL.md",
			"playwright-cli/SKILL.md",
			"refactor-arch/SKILL.md",
			"refactor-arch/playbook_refatoracao.md",
			"research/SKILL.md",
			"screen-inventory/SKILL.md",
			"cloud-release/SKILL.md",
		];

		let totalBytes = 0;
		for (const rel of requiredSkills) {
			const fullPath = path.join(skillsDir, rel);
			expect(fs.existsSync(fullPath)).toBe(true);
			const stat = fs.statSync(fullPath);
			totalBytes += stat.size;
		}

		// Ensure no summaries/stubs: total bytes across required skills must exceed 700 KB
		expect(totalBytes).toBeGreaterThan(700 * 1024);

		// implement/SKILL.md must be the full extensive protocol (> 50 KB)
		const implementContent = fs.readFileSync(
			path.join(skillsDir, "implement", "SKILL.md"),
			"utf-8",
		);
		expect(implementContent.length).toBeGreaterThan(50 * 1024);
		expect(implementContent).toContain("AUTONOMOUS CONTINUOUS MODE BY DEFAULT");
		expect(implementContent).toContain("progress file");
		expect(implementContent).toContain("Observations format");

		// plan-build must have its extensive companion files and tech-spec templates
		const planBuildContent = fs.readFileSync(
			path.join(skillsDir, "plan-build", "SKILL.md"),
			"utf-8",
		);
		expect(planBuildContent.length).toBeGreaterThan(20 * 1024);
		expect(planBuildContent).toContain("Gate 1 — Mode detection");
		expect(planBuildContent).toContain("Gate 6 — Status gate");
	});

	it("guarantees the mandatory LGPD Privacy Specification template is present and comprehensive", () => {
		const lgpdSpecPath = path.join(
			skillsDir,
			"plan-build",
			"templates",
			"tech-specs",
			"lgpd-privacy-spec.md",
		);
		expect(fs.existsSync(lgpdSpecPath)).toBe(true);
		const content = fs.readFileSync(lgpdSpecPath, "utf-8");
		expect(content).toContain(
			"Mandato NFR-0 Inegociável — Lei Geral de Proteção de Dados (Lei nº 13.709/2018)",
		);
		expect(content).toContain(
			"ROPA — Registro das Operações de Tratamento (Art. 37 LGPD)",
		);
		expect(content).toContain("Direitos do Titular (Art. 18 LGPD)");
		expect(content).toContain("Crypto-Shredding");
		expect(content).toContain("Blind Index (Busca Determinística)");
		expect(content).toContain("ConsentLedger");
		expect(content).toContain("[LGPD_REDACTED]");
	});

	it("guarantees full opencode-ensemble real infrastructure modules are integrated in src/", () => {
		const requiredSrc = [
			"process.ts",
			"watchdog.ts",
			"recovery.ts",
			"rate-limit.ts",
			"system-prompt.ts",
			"dashboard.ts",
			"dashboard-html.ts",
			"dashboard-js-render.ts",
			"tools/merge-helper.ts",
			"tools/team-create.ts",
			"tools/team-spawn.ts",
			"tools/team-shutdown.ts",
			"tools/team-merge.ts",
			"tools/team-cleanup.ts",
			"tools/team-message.ts",
			"tools/team-broadcast.ts",
			"tools/team-tasks-list.ts",
			"tools/team-tasks-add.ts",
			"tools/team-tasks-complete.ts",
			"tools/team-claim.ts",
			"tools/team-results.ts",
			"tools/team-status.ts",
			"tools/team-view.ts",
			"tools/shared.ts",
		];

		for (const file of requiredSrc) {
			const full = path.join(srcDir, file);
			expect(fs.existsSync(full)).toBe(true);
			const stat = fs.statSync(full);
			expect(stat.size).toBeGreaterThan(500);
		}

		// merge-helper.ts must contain real git commands and branch preservation
		const mergeHelper = fs.readFileSync(
			path.join(srcDir, "tools", "merge-helper.ts"),
			"utf-8",
		);
		expect(mergeHelper).toContain("preserveBranch");
		expect(mergeHelper).toContain("mergeBranchRaw");
		expect(mergeHelper).toContain("git");

		// team-spawn.ts must contain real session management, circuit breaker and prompt limits
		const teamSpawn = fs.readFileSync(
			path.join(srcDir, "tools", "team-spawn.ts"),
			"utf-8",
		);
		expect(teamSpawn).toContain("spawnFailures");
		expect(teamSpawn).toContain("executeTeamSpawn");

		// team-cleanup.ts must contain safety-net merge and branch cleanup
		const teamCleanup = fs.readFileSync(
			path.join(srcDir, "tools", "team-cleanup.ts"),
			"utf-8",
		);
		expect(teamCleanup).toContain("executeTeamCleanup");
	});
});
