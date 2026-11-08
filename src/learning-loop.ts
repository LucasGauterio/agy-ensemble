import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "./db";

/**
 * Stage 10 Autonomous Retrospective & Self-Learning Loop:
 * Persists <friction-and-learnings> into SQLite team_learnings, appends to docs/learnings/KNOWLEDGE_BASE.md,
 * updates testing gotchas.md, and automatically generates a preventive rule in docs/rules/plan-validate/.
 */
export function processStage10ContinuousLearning(
	db: Database,
	input: {
		projectDir: string;
		teamId: string;
		phaseId: string;
		siId: string;
		category: string;
		fixLoopAttempts: number;
		rootCause: string;
		preventiveRule: string;
	},
): {
	recordedInSqlite: boolean;
	knowledgeBasePath: string;
	gotchasPath: string;
	generatedRulePath: string;
} {
	const id = `learn_${crypto.randomUUID()}`;
	const now = Date.now();
	const ruleFileName = `auto-rule-${input.siId.toLowerCase().replace(/[^a-z0-9]/g, "-")}.md`;
	const relRulePath = `docs/rules/plan-validate/${ruleFileName}`;

	db.run(
		`INSERT INTO team_learnings (
      id, team_id, phase_id, si_id, category, fix_loop_attempts,
      root_cause, preventive_rule, rule_file_created, time_created
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			input.teamId,
			input.phaseId,
			input.siId,
			input.category,
			input.fixLoopAttempts,
			input.rootCause,
			input.preventiveRule,
			relRulePath,
			now,
		],
	);

	const knowledgeBasePath = path.join(
		input.projectDir,
		"docs",
		"learnings",
		"KNOWLEDGE_BASE.md",
	);
	fs.mkdirSync(path.dirname(knowledgeBasePath), { recursive: true });
	fs.appendFileSync(
		knowledgeBasePath,
		`\n## [${input.phaseId} / ${input.siId}] (${input.category}) — ${input.fixLoopAttempts} Fix Loop Attempts\n- **Root Cause:** ${input.rootCause}\n- **Preventive Rule:** ${input.preventiveRule}\n`,
		"utf8",
	);

	const gotchasPath = path.join(
		input.projectDir,
		"docs",
		"testing",
		"gotchas.md",
	);
	fs.mkdirSync(path.dirname(gotchasPath), { recursive: true });
	fs.appendFileSync(
		gotchasPath,
		`\n- **${input.siId} (${input.category}):** ${input.preventiveRule}\n`,
		"utf8",
	);

	const generatedRulePath = path.join(input.projectDir, relRulePath);
	fs.mkdirSync(path.dirname(generatedRulePath), { recursive: true });
	fs.writeFileSync(
		generatedRulePath,
		`# Auto-Generated Preventive Rule (${input.siId})\n\n- **Category:** ${input.category}\n- **Root Cause:** ${input.rootCause}\n- **Mandatory Check:** ${input.preventiveRule}\n`,
		"utf8",
	);

	return {
		recordedInSqlite: true,
		knowledgeBasePath,
		gotchasPath,
		generatedRulePath,
	};
}
