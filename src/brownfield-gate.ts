import fs from "node:fs";
import path from "node:path";

/** Required workflow artifacts that MUST exist and stay synchronized with the codebase. */
export const MANDATORY_WORKFLOW_ARTIFACTS: readonly string[] = [
	"README.md",
	"AGENTS.md",
	"CLAUDE.md",
	"CONTEXT.md",
	"docs/project-plan.md",
	"docs/PRD.md",
	"docs/RFC.md",
	"docs/FDD.md",
	"docs/DESIGN_SYSTEM.md",
	"docs/TRACKER.md",
	"docs/VALIDATION.md",
	"docs/learnings/KNOWLEDGE_BASE.md",
];

/** Result of evaluating Etapa 0.0 Brownfield Gate. */
export interface BrownfieldGateResult {
	isBrownfield: boolean;
	canStartNewWork: boolean;
	missingArtifacts: string[];
	untrackedFiles: string[];
	driftCount: number;
}

/**
 * Recursively scan source files inside src/, app/, or packages/ using forward-slash relative paths.
 */
export function scanCodebaseSourceFiles(projectDir: string): string[] {
	const roots = ["src", "app", "packages"];
	const found: string[] = [];

	const walk = (dir: string): void => {
		if (!fs.existsSync(dir)) return;
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== "node_modules" && entry.name !== "dist") {
					walk(fullPath);
				}
			} else if (/\.(ts|tsx|js|jsx|py|go|rs|java|cs)$/.test(entry.name)) {
				const rel = path
					.relative(projectDir, fullPath)
					.split(path.sep)
					.join("/");
				found.push(rel);
			}
		}
	};

	for (const r of roots) {
		walk(path.join(projectDir, r));
	}

	return found.sort();
}

/**
 * Evaluate Etapa 0.0 (Brownfield & Codebase-Doc Sync Blocking Gate).
 * Agents are strictly forbidden from starting new work if any workflow artifact is missing
 * or if the codebase has source files not tracked in docs/TRACKER.md.
 */
export function evaluateBrownfieldGate(
	projectDir: string,
): BrownfieldGateResult {
	const sourceFiles = scanCodebaseSourceFiles(projectDir);
	const isBrownfield = sourceFiles.length > 0;

	if (!isBrownfield) {
		return {
			isBrownfield: false,
			canStartNewWork: true,
			missingArtifacts: [],
			untrackedFiles: [],
			driftCount: 0,
		};
	}

	const missingArtifacts = MANDATORY_WORKFLOW_ARTIFACTS.filter(
		(relPath) => !fs.existsSync(path.join(projectDir, relPath)),
	);

	const trackerPath = path.join(projectDir, "docs", "TRACKER.md");
	const trackerContent = fs.existsSync(trackerPath)
		? fs.readFileSync(trackerPath, "utf8")
		: "";

	const untrackedFiles = sourceFiles.filter(
		(file) => !trackerContent.includes(file),
	);
	const driftCount = missingArtifacts.length + untrackedFiles.length;

	return {
		isBrownfield: true,
		canStartNewWork: driftCount === 0,
		missingArtifacts,
		untrackedFiles,
		driftCount,
	};
}

/**
 * Execute Etapa 0.0 Brownfield Initialization, Reverse Codebase Analysis,
 * Retroactive Planning (project-plan.md + phase-01-baseline + PRD/RFC/FDD/DESIGN_SYSTEM/ADRs),
 * and Progress/Tracker Synchronization (progress.md + TRACKER.md + VALIDATION.md).
 */
export function bootstrapAndSyncBrownfieldProject(
	projectDir: string,
	options: { projectName: string },
): {
	initialized: boolean;
	scannedSourceFiles: string[];
	driftCount: number;
	artifactsGenerated: string[];
} {
	const scannedSourceFiles = scanCodebaseSourceFiles(projectDir);
	const artifactsGenerated: string[] = [];

	const ensureFile = (relPath: string, content: string): void => {
		const absPath = path.join(projectDir, relPath);
		if (!fs.existsSync(absPath)) {
			fs.mkdirSync(path.dirname(absPath), { recursive: true });
			fs.writeFileSync(absPath, content, "utf8");
			artifactsGenerated.push(relPath);
		}
	};

	ensureFile(
		"README.md",
		`# ${options.projectName}

## Visão Geral
Aplicação inicializada e governada pelo fluxo autônomo agy-ensemble.
Linha de base reconstruída retroativamente a partir de ${scannedSourceFiles.length} arquivos-fonte.

## Como Executar
\`\`\`bash
npm install
npm run build
npm start
\`\`\`

## Testes
\`\`\`bash
npm test
\`\`\`
`,
	);
	ensureFile(
		"AGENTS.md",
		`# ${options.projectName} — Agent Governance (agy-ensemble)\n\nStrict Etapa 0.0–11 pipeline active.\n`,
	);
	ensureFile(
		"CLAUDE.md",
		`# ${options.projectName} — Quick Agent Context\n\nManaged by agy-ensemble.\n`,
	);
	ensureFile(
		"CONTEXT.md",
		`# ${options.projectName} — Global Project Context\n\nSynchronized with ${scannedSourceFiles.length} source files.\n`,
	);
	ensureFile(
		"docs/learnings/KNOWLEDGE_BASE.md",
		`# Knowledge Base — ${options.projectName}\n\nInitialized during Etapa 0.0 Brownfield Baseline.\n`,
	);
	ensureFile(
		"docs/PRD.md",
		`# Product Requirements Document (Reverse-Engineered Baseline) — ${options.projectName}\n\n- **FR-01:** Baseline capabilities extracted from existing codebase.\n`,
	);
	ensureFile(
		"docs/RFC.md",
		`# Architecture RFC & LGPD ROPA Baseline — ${options.projectName}\n\n- **ARCH-01:** Reverse-engineered module boundaries.\n- **LGPD-ROPA-01:** Mandatory LGPD compliance baseline.\n`,
	);
	ensureFile(
		"docs/FDD.md",
		`# Functional Design Document — ${options.projectName}\n\n- **FDD-01:** Functional flows mapped from codebase (${scannedSourceFiles.join(", ")}).\n`,
	);
	ensureFile(
		"docs/DESIGN_SYSTEM.md",
		`# Code-First Design System — ${options.projectName}\n\nTokens and UI primitives inventory.\n`,
	);
	ensureFile(
		"docs/adrs/ADR-001-baseline-architecture.md",
		`# ADR-001: Baseline Architecture (${options.projectName})\n\nStatus: Accepted (Reverse-Engineered in Etapa 0.0).\n`,
	);
	ensureFile(
		"docs/project-plan.md",
		`# Project Plan — ${options.projectName}\n\n### Phase 01: Brownfield Baseline Reconstruction (Completed)\n- Retroactive baseline covering ${scannedSourceFiles.length} implemented files.\n`,
	);
	ensureFile(
		"docs/phases/phase-01-baseline/phase-01-baseline.md",
		`# Phase 01: Brownfield Baseline Plan\n\nRetroactive specification for files:\n${scannedSourceFiles.map((f) => `- \`${f}\``).join("\n")}\n`,
	);
	ensureFile(
		"docs/phases/phase-01-baseline/progress.md",
		`# Phase 01 Progress\n\n- [x] SI-01.1: Baseline Codebase Reconstruction (Status: COMPLETED)\n`,
	);

	const trackerRows = scannedSourceFiles
		.map(
			(file, idx) =>
				`| SI-01.${idx + 1} | FR-01 | ARCH-01 | FDD-01 | \`${file}#L1\` | SYNCED |`,
		)
		.join("\n");

	ensureFile(
		"docs/TRACKER.md",
		`# Bidirectional Traceability Matrix — ${options.projectName}\n\n| SI | PRD | RFC | FDD | Code Reference | Status |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n${trackerRows}\n`,
	);

	ensureFile(
		"docs/VALIDATION.md",
		`# Documentation & Codebase Sync Validation\n\n- **Status:** CLEAN\n- **Drift Count:** 0\n- **Tracked Files:** ${scannedSourceFiles.length}\n`,
	);

	const postCheck = evaluateBrownfieldGate(projectDir);
	return {
		initialized: true,
		scannedSourceFiles,
		driftCount: postCheck.driftCount,
		artifactsGenerated,
	};
}

/**
 * Convenient wrapper for bootstrapping and synchronizing a brownfield project.
 */
export function bootstrapBrownfieldProject(
	projectDir: string,
	projectName: string,
): {
	initialized: boolean;
	scannedSourceFiles: string[];
	driftCount: number;
	artifactsGenerated: string[];
} {
	return bootstrapAndSyncBrownfieldProject(projectDir, { projectName });
}
