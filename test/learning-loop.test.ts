import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb } from "../src/db";
import { processStage10ContinuousLearning } from "../src/learning-loop";
import { ensembleCreate } from "../src/mcp-server";

describe("IMP-13 / VAL-13: Stage 10 Continuous Self-Learning & Skill Evolution Loop", () => {
	test("processes <friction-and-learnings> when fixLoopAttempts > 1, persists to SQLite team_learnings, updates KNOWLEDGE_BASE.md + gotchas.md, and creates a preventive rule in docs/rules/plan-validate/", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-learning-"));
		const db = createDb(":memory:");
		const team = ensembleCreate(db, {
			name: "learning-team",
			leadSessionId: "lead-learn",
		});

		const outcome = processStage10ContinuousLearning(db, {
			projectDir: tmpDir,
			teamId: team.id,
			phaseId: "Phase-01",
			siId: "SI-01.2",
			category: "orm-migration",
			fixLoopAttempts: 3,
			rootCause:
				"Missing explicit schema search_path on raw SQL migration query",
			preventiveRule:
				"Always qualify schema or set search_path in tenant-isolated migrations",
		});

		expect(outcome.recordedInSqlite).toBe(true);
		expect(fs.existsSync(outcome.knowledgeBasePath)).toBe(true);
		expect(fs.existsSync(outcome.gotchasPath)).toBe(true);
		expect(fs.existsSync(outcome.generatedRulePath)).toBe(true);
		expect(fs.readFileSync(outcome.generatedRulePath, "utf8")).toContain(
			"Always qualify schema or set search_path",
		);

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});
});
