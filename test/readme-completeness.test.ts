import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const README_PATH = path.resolve(import.meta.dir, "..", "README.md");

describe("IMP-15 / VAL-15: Official README.md Completeness & Architectural Coverage", () => {
	test("verifies README.md exists and documents all 12 mandatory sections and session requirements", () => {
		expect(fs.existsSync(README_PATH)).toBe(true);
		const content = fs.readFileSync(README_PATH, "utf8");

		// 1. Overview & Roles (Lead vs Teammates vs Red-Team vs Readers)
		expect(content).toContain("# agy-ensemble");
		expect(content).toContain("delegate: true");
		expect(content).toContain("Workspace: 'share'");
		expect(content).toContain("worker-teammate");
		expect(content).toContain("worker-pentest");

		// 2. Non-Negotiable Invariants & Branch Preservation
		expect(content).toContain("preserveBranch");
		expect(content).toContain("ensemble/preserved/");
		expect(content).toContain("File-Touch Disjointness");

		// 3 & 4. Etapa 0.0 (Brownfield Gate) & Etapa 1.0 (Iterative Interview & Consolidated Request)
		expect(content).toContain("Etapa 0.0");
		expect(content).toContain("Brownfield");
		expect(content).toContain("0 drift");
		expect(content).toContain("Etapa 1.0");
		expect(content).toContain("ask_question");
		expect(content).toContain("(Recommended)");
		expect(content).toContain("Requisição Consolidada Oficial");

		// 5. Stack Synergy, 3-Tier Volumetry, Economic Viability & Context7
		expect(content).toContain("Stack Synergy Engine");
		expect(content).toContain("Seed");
		expect(content).toContain("Growth");
		expect(content).toContain("Scale");
		expect(content).toContain("FINOPS-VIABILITY-N");
		expect(content).toContain("Context7");
		expect(content).toContain("library-refs.md");

		// 6. Code-First Design System (No Figma) & Wave Zero
		expect(content).toContain("docs/DESIGN_SYSTEM.md");
		expect(content).toContain("SI-NN.0.1");

		// 7. Multi-Tenant Container & Vault Isolation
		expect(content).toContain("s_si_nn_x");
		expect(content).toContain("u_si_nn_x");
		expect(content).toContain("Vault");

		// 8. Mandate NFR-0 & Mandatory Brazilian LGPD (Lei 13.709/2018)
		expect(content).toContain("NFR-0");
		expect(content).toContain("LGPD");
		expect(content).toContain("13.709/2018");
		expect(content).toContain("ROPA");
		expect(content).toContain("Art. 18");
		expect(content).toContain("Crypto-Shredding");
		expect(content).toContain("[LGPD_REDACTED]");
		expect(content).toContain("Gitleaks");
		expect(content).toContain("OpenTelemetry");

		// 9. 3-Layer Testing, Native Reports, SonarQube & SAST/DAST/PenTests
		expect(content).toContain("SonarQube");
		expect(content).toContain("JUnit XML");
		expect(content).toContain("CTRF JSON");
		expect(content).toContain("LCOV");
		expect(content).toContain("SAST");
		expect(content).toContain("DAST");
		expect(content).toContain("PenTests");
		expect(content).toContain("OWASP ZAP");
		expect(content).toContain("Semgrep");

		// 10. Live Execution Trace Graph UI, FinOps ($ Est vs Real) & Stage 10 Self-Learning
		expect(content).toContain("sidecar://agy-ensemble/trace-graph");
		expect(content).toContain("cost_time_calibration");
		expect(content).toContain("<friction-and-learnings>");
		expect(content).toContain("KNOWLEDGE_BASE.md");

		// 11. Production Cloud Deployment (GitHub Actions + gcloud/gh/wrangler/aws/az) & 3 Runbooks
		expect(content).toContain("GitHub Actions");
		expect(content).toContain("gcloud");
		expect(content).toContain("wrangler");
		expect(content).toContain("PRODUCTION_DEPLOY_GUIDE.md");
		expect(content).toContain("DEPENDENCIES_AND_CREDENTIALS_RUNBOOK.md");
		expect(content).toContain("USER_TEST_PLAYBOOK.md");

		// 12. 15 MCP Tools & Verification Commands
		expect(content).toContain("ensemble_import_phase_plan");
		expect(content).toContain("ensemble_merge");
		expect(content).toContain("bun run verify");
	});

	test("guarantees README.md contains clear instructions on how to install and how to use", () => {
		expect(fs.existsSync(README_PATH)).toBe(true);
		const content = fs.readFileSync(README_PATH, "utf8");

		expect(content).toContain("Como Instalar");
		expect(content).toContain("Como Utilizar");
		expect(content).toContain("git clone");
		expect(content).toContain("mcp.json");
		expect(content).toContain("/agy-ensemble");
		expect(content).toContain("Greenfield");
		expect(content).toContain("Brownfield");
	});

	test("guarantees README.md and documentation contain no hardcoded local absolute paths", () => {
		const rootDir = path.resolve(import.meta.dir, "..");
		const docFiles = [
			path.join(rootDir, "README.md"),
			path.join(rootDir, "SKILL.md"),
			path.join(rootDir, "AGENTS.md"),
			path.join(rootDir, "rules", "mandatory-readme-sync.md"),
			path.join(rootDir, "docs", "IMPLEMENTATION_AND_VALIDATION.md"),
		];

		const forbiddenPatterns = [
			/E:[\\\/]Projects/i,
			/C:[\\\/]Users/i,
			/file:\/\/\/[A-Za-z]:/i,
		];

		for (const docFile of docFiles) {
			if (fs.existsSync(docFile)) {
				const text = fs.readFileSync(docFile, "utf-8");
				for (const pattern of forbiddenPatterns) {
					const match = text.match(pattern);
					expect(match).toBeNull();
				}
			}
		}
	});
});
