import * as fs from "node:fs";
import * as path from "node:path";

/** Inputs for evaluating phase README synchronization. */
export interface PhaseReadmeSyncInput {
	projectDir: string;
	phaseId: string;
	phaseName: string;
	newEnvVars?: string[];
	newEndpoints?: string[];
}

/** Result of phase README synchronization evaluation. */
export interface PhaseReadmeSyncResult {
	canCompletePhase: boolean;
	missingDeliverables: string[];
	reason?: string;
}

/** Result of skill README synchronization evaluation. */
export interface SkillReadmeSyncResult {
	isSynchronized: boolean;
	documentedToolsCount: number;
	documentedStagesCount: number;
	missingItems: string[];
}

/**
 * Evaluates whether the project README.md is properly updated before closing a phase (Etapa 9 / Squash Merge).
 * Blocks phase completion if the README does not reflect the newly delivered phase, new env vars, or endpoints.
 */
export function evaluatePhaseReadmeSync(
	input: PhaseReadmeSyncInput,
): PhaseReadmeSyncResult {
	const readmePath = path.join(input.projectDir, "README.md");
	if (!fs.existsSync(readmePath)) {
		return {
			canCompletePhase: false,
			missingDeliverables: ["README.md file missing"],
			reason: "Project README.md does not exist in root directory.",
		};
	}

	const content = fs.readFileSync(readmePath, "utf-8");
	const missingDeliverables: string[] = [];

	// 1. Must mention phase identifier or name
	const hasPhaseId = content.toLowerCase().includes(input.phaseId.toLowerCase());
	const hasPhaseName = content
		.toLowerCase()
		.includes(input.phaseName.toLowerCase());
	if (!hasPhaseId && !hasPhaseName) {
		missingDeliverables.push("Phase identifier or name");
	}

	// 2. Must mention new environment variables
	if (input.newEnvVars && input.newEnvVars.length > 0) {
		for (const envVar of input.newEnvVars) {
			if (!content.includes(envVar)) {
				missingDeliverables.push(`Environment variable: ${envVar}`);
			}
		}
	}

	// 3. Must mention new endpoints
	if (input.newEndpoints && input.newEndpoints.length > 0) {
		for (const ep of input.newEndpoints) {
			if (!content.includes(ep)) {
				missingDeliverables.push(`Endpoint: ${ep}`);
			}
		}
	}

	if (missingDeliverables.length > 0) {
		return {
			canCompletePhase: false,
			missingDeliverables,
			reason: `Project README.md must be updated with all phase deliverables before closing: ${missingDeliverables.join(", ")}`,
		};
	}

	return {
		canCompletePhase: true,
		missingDeliverables: [],
	};
}

/**
 * Evaluates whether the agy-ensemble skill's own README.md is properly synchronized with all tools and workflow stages.
 */
export function evaluateSkillReadmeSync(
	skillRootDir: string,
): SkillReadmeSyncResult {
	const readmePath = path.join(skillRootDir, "README.md");
	if (!fs.existsSync(readmePath)) {
		return {
			isSynchronized: false,
			documentedToolsCount: 0,
			documentedStagesCount: 0,
			missingItems: ["README.md does not exist in skill root."],
		};
	}

	const content = fs.readFileSync(readmePath, "utf-8");
	const missingItems: string[] = [];

	const baseTools = [
		"create",
		"spawn",
		"message",
		"broadcast",
		"tasks_list",
		"tasks_add",
		"tasks_complete",
		"claim",
		"results",
		"shutdown",
		"merge",
		"cleanup",
		"status",
		"view",
	];

	let documentedToolsCount = 0;
	for (const tool of baseTools) {
		const mcpPattern = `ensemble_${tool}`;
		const teamPattern = `team_${tool}`;
		if (content.includes(mcpPattern) || content.includes(teamPattern)) {
			documentedToolsCount++;
		} else {
			missingItems.push(`Tool: ensemble_${tool} / team_${tool}`);
		}
	}

	const stages = [
		"Etapa 0.0",
		"Etapa 1.0",
		"Etapa 2",
		"Etapa 2.5",
		"Etapa 3",
		"Etapa 4",
		"Etapa 5",
		"Etapa 6",
		"Etapa 7",
		"Etapa 8",
		"Etapa 9",
		"Etapa 10",
		"Etapa 11",
	];

	let documentedStagesCount = 0;
	for (const stage of stages) {
		if (content.includes(stage)) {
			documentedStagesCount++;
		} else {
			missingItems.push(`Stage: ${stage}`);
		}
	}

	const isSynchronized =
		documentedToolsCount >= 14 && documentedStagesCount >= stages.length;

	return {
		isSynchronized,
		documentedToolsCount,
		documentedStagesCount,
		missingItems,
	};
}
