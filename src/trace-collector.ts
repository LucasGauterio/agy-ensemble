import crypto from "node:crypto";
import type { Database } from "./db";

/**
 * Evaluate PreToolUse hook rules:
 * 1. Block sub-agent spawning from Teammate sessions (Sub-agent isolation).
 * 2. Block git commit --no-verify (Gitleaks pre-commit hook protection).
 */
export function evaluatePreToolUseHook(input: {
	callerRole: "lead" | "teammate";
	toolName: string;
	commandLine: string;
}): { allowed: boolean; reason?: string } {
	if (
		input.callerRole === "teammate" &&
		(input.toolName === "invoke_subagent" ||
			input.toolName === "ensemble_spawn")
	) {
		return {
			allowed: false,
			reason: "Sub-agent isolation: Teammate sessions cannot spawn sub-agents.",
		};
	}

	if (
		input.toolName === "run_command" &&
		/git\s+commit\b.*(--no-verify|-n\b)/i.test(input.commandLine)
	) {
		return {
			allowed: false,
			reason:
				"Gitleaks bypass forbidden: git commit --no-verify is blocked by agy-ensemble.",
		};
	}

	return { allowed: true };
}

/**
 * Record the start of an execution span in trace_nodes (and parent edge in trace_edges).
 */
export function recordActionSpanStart(
	db: Database,
	input: {
		teamId: string;
		parentId?: string;
		zoomLevel: 1 | 2 | 3;
		nodeKind: string;
		label: string;
		agentName?: string;
		siId?: string;
		estCostUsd: number;
		estDurationMs: number;
		payload?: Record<string, unknown>;
	},
): { id: string; timeStarted: number } {
	const id = `span_${crypto.randomUUID()}`;
	const now = Date.now();

	db.run(
		`INSERT INTO trace_nodes (
      id, team_id, parent_id, zoom_level, node_kind, label, agent_name, si_id,
      status, est_cost_usd, est_duration_ms, payload_json, time_started
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?)`,
		[
			id,
			input.teamId,
			input.parentId ?? null,
			input.zoomLevel,
			input.nodeKind,
			input.label,
			input.agentName ?? null,
			input.siId ?? null,
			input.estCostUsd,
			input.estDurationMs,
			JSON.stringify(input.payload ?? {}),
			now,
		],
	);

	if (input.parentId) {
		db.run(
			`INSERT INTO trace_edges (id, team_id, source_id, target_id, edge_kind, label, time_created)
       VALUES (?, ?, ?, ?, 'HIERARCHY', 'parent-child', ?)`,
			[`edge_${crypto.randomUUID()}`, input.teamId, input.parentId, id, now],
		);
	}

	return { id, timeStarted: now };
}

/**
 * Record the completion of an execution span with actual cost ($), tokens, and duration (ms).
 */
export function recordActionSpanComplete(
	db: Database,
	input: {
		spanId: string;
		status: string;
		inputTokens: number;
		outputTokens: number;
		actualCostUsd: number;
		actualDurationMs: number;
	},
): { actualCostUsd: number; actualDurationMs: number } {
	const now = Date.now();
	db.run(
		`UPDATE trace_nodes
     SET status = ?, input_tokens = ?, output_tokens = ?, actual_cost_usd = ?, actual_duration_ms = ?, time_completed = ?
     WHERE id = ?`,
		[
			input.status,
			input.inputTokens,
			input.outputTokens,
			input.actualCostUsd,
			input.actualDurationMs,
			now,
			input.spanId,
		],
	);

	return {
		actualCostUsd: input.actualCostUsd,
		actualDurationMs: input.actualDurationMs,
	};
}
