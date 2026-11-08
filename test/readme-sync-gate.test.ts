import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	bootstrapBrownfieldProject,
	evaluateBrownfieldGate,
	MANDATORY_WORKFLOW_ARTIFACTS,
} from "../src/brownfield-gate";
import {
	evaluatePhaseReadmeSync,
	evaluateSkillReadmeSync,
} from "../src/readme-sync-evaluator";

describe("IMP-17 / VAL-17: Mandatory Continuous README Synchronization Gate", () => {
	it("enforces README.md as a mandatory workflow artifact in Etapa 0.0 Brownfield Gate", () => {
		expect(MANDATORY_WORKFLOW_ARTIFACTS).toContain("README.md");

		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), "agy-brownfield-readme-"),
		);
		try {
			fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
			fs.writeFileSync(
				path.join(tempDir, "src", "index.ts"),
				"export const app = 1;",
			);

			// Evaluating gate without README.md must block new work and list README.md as missing
			const gateBefore = evaluateBrownfieldGate(tempDir);
			expect(gateBefore.canStartNewWork).toBe(false);
			expect(gateBefore.missingArtifacts).toContain("README.md");

			// Bootstrapping must generate README.md with real project overview and setup instructions
			const bootstrap = bootstrapBrownfieldProject(
				tempDir,
				"My Brownfield App",
			);
			expect(bootstrap.artifactsGenerated).toContain("README.md");
			expect(fs.existsSync(path.join(tempDir, "README.md"))).toBe(true);

			const readmeContent = fs.readFileSync(
				path.join(tempDir, "README.md"),
				"utf-8",
			);
			expect(readmeContent).toContain("# My Brownfield App");
			expect(readmeContent).toContain("## Visão Geral");
			expect(readmeContent).toContain("## Como Executar");
			expect(readmeContent).toContain("## Testes");

			// After bootstrap, gate must pass with 0 drift
			const gateAfter = evaluateBrownfieldGate(tempDir);
			expect(gateAfter.canStartNewWork).toBe(true);
			expect(gateAfter.driftCount).toBe(0);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("blocks phase completion in Etapa 9/10 if project README.md is not updated with phase deliverables (Error path)", () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-phase-readme-"));
		try {
			// Write an outdated README that does not mention Phase 02 or its new routes/env vars
			fs.writeFileSync(
				path.join(tempDir, "README.md"),
				"# Test App\n\n## Visão Geral\nVersão inicial apenas com Fase 01.\n",
			);
			fs.writeFileSync(
				path.join(tempDir, ".env.example"),
				"DATABASE_URL=postgres://localhost/db\nVAULT_TOKEN=secret\n",
			);

			const result = evaluatePhaseReadmeSync({
				projectDir: tempDir,
				phaseId: "phase-02-auth",
				phaseName: "Autenticação e Controle de Acesso LGPD",
				newEnvVars: ["VAULT_TOKEN"],
				newEndpoints: ["POST /api/v1/auth/login", "POST /api/v1/auth/consent"],
			});

			expect(result.canCompletePhase).toBe(false);
			expect(result.missingDeliverables.length).toBeGreaterThan(0);
			expect(result.missingDeliverables).toContain("Phase identifier or name");
			expect(result.reason).toContain("README.md must be updated");
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("passes phase completion when project README.md reflects phase deliverables, env vars, and setup", () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), "agy-phase-readme-pass-"),
		);
		try {
			const updatedReadme = `# Test App

## Visão Geral
Aplicação empresarial com gestão de dados em conformidade com LGPD.

## Fases Entregues
- **Fase 01**: Baseline e Infraestrutura
- **Fase 02**: Autenticação e Controle de Acesso LGPD (phase-02-auth)

### Endpoints
- \`POST /api/v1/auth/login\`
- \`POST /api/v1/auth/consent\`

## Variáveis de Ambiente
- \`VAULT_TOKEN\`: Token de autenticação no Vault Transit

## Como Executar
\`\`\`bash
docker compose up -d
npm test
\`\`\`
`;
			fs.writeFileSync(path.join(tempDir, "README.md"), updatedReadme);

			const result = evaluatePhaseReadmeSync({
				projectDir: tempDir,
				phaseId: "phase-02-auth",
				phaseName: "Autenticação e Controle de Acesso LGPD",
				newEnvVars: ["VAULT_TOKEN"],
				newEndpoints: ["POST /api/v1/auth/login", "POST /api/v1/auth/consent"],
			});

			expect(result.canCompletePhase).toBe(true);
			expect(result.missingDeliverables).toHaveLength(0);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("guarantees the agy-ensemble skill's own README.md stays synchronized with all tools and workflow stages", () => {
		const skillRootDir = path.resolve(__dirname, "..");
		const result = evaluateSkillReadmeSync(skillRootDir);

		expect(result.isSynchronized).toBe(true);
		expect(result.documentedToolsCount).toBeGreaterThanOrEqual(14);
		expect(result.documentedStagesCount).toBeGreaterThanOrEqual(12);
	});
});
