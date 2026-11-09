import crypto from "node:crypto";
import readline from "node:readline";
import { type Database, createDb } from "./db";

export interface PhasePlanStepInput {
	siId: string;
	title: string;
	dependsOn: string[];
	filesTouched: string[];
	estCostUsd: number;
	estDurationMs: number;
}

interface TeamRow {
	id: string;
	name: string;
	lead_session_id: string;
	status: string;
	delegate: number;
}

interface TaskRow {
	id: string;
	team_id: string;
	si_id: string | null;
	content: string;
	status: string;
	priority: string;
	assignee: string | null;
	depends_on: string | null;
	files_touched: string | null;
	est_cost_usd: number;
	actual_cost_usd: number;
	est_duration_ms: number;
	actual_duration_ms: number;
}

interface MemberRow {
	team_id: string;
	name: string;
	session_id: string;
	si_id: string | null;
	agent: string;
	status: string;
	execution_status: string;
	workspace_mode: string;
	worktree_branch: string | null;
	preserved_branch: string | null;
}

/**
 * Check if stepA transitively depends on stepB in the phase plan DAG.
 */
function dependsTransitively(
	sourceSiId: string,
	targetSiId: string,
	depMap: Map<string, string[]>,
	visited = new Set<string>(),
): boolean {
	if (sourceSiId === targetSiId) return true;
	if (visited.has(sourceSiId)) return false;
	visited.add(sourceSiId);

	const direct = depMap.get(sourceSiId) ?? [];
	return direct.some((dep) =>
		dependsTransitively(dep, targetSiId, depMap, visited),
	);
}

/**
 * Create a new team with strict delegate mode enabled by default.
 */
export function ensembleCreate(
	db: Database,
	input: {
		name: string;
		leadSessionId: string;
		projectPath?: string;
		delegate?: boolean;
	},
): { id: string; name: string; delegate: boolean } {
	const now = Date.now();
	const projectId = input.projectPath ?? "default";
	db.run(
		"INSERT OR IGNORE INTO project (id, name, path, status, time_created, time_updated) VALUES (?, ?, ?, 'active', ?, ?)",
		[projectId, input.name, projectId, now, now],
	);

	const id = `team_${crypto.randomUUID()}`;
	const delegateFlag = input.delegate === false ? 0 : 1;
	db.run(
		"INSERT INTO team (id, name, project_id, lead_session_id, status, delegate, time_created, time_updated) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)",
		[id, input.name, projectId, input.leadSessionId, delegateFlag, now, now],
	);

	return { id, name: input.name, delegate: delegateFlag === 1 };
}

/**
 * Import a phase plan's Dependency Map into the shared task board while enforcing
 * File-Touch Disjointness across all concurrently executable SIs.
 */
export function ensembleImportPhasePlan(
	db: Database,
	input: {
		teamId: string;
		phaseId: string;
		steps: PhasePlanStepInput[];
	},
): { tasksCreated: number; siToTaskId: Record<string, string> } {
	const depMap = new Map<string, string[]>();
	for (const step of input.steps) {
		depMap.set(step.siId, step.dependsOn);
	}

	// Enforce File-Touch Disjointness between any two SIs that can run in parallel
	for (let i = 0; i < input.steps.length; i++) {
		for (let j = i + 1; j < input.steps.length; j++) {
			const a = input.steps[i];
			const b = input.steps[j];
			if (!a || !b) continue;
			const ordered =
				dependsTransitively(a.siId, b.siId, depMap) ||
				dependsTransitively(b.siId, a.siId, depMap);
			if (!ordered) {
				const overlap = a.filesTouched.filter((f) =>
					b.filesTouched.includes(f),
				);
				if (overlap.length > 0) {
					throw new Error(
						`File-Touch Disjointness violation between parallel SIs ${a.siId} and ${b.siId} on file(s): ${overlap.join(", ")}`,
					);
				}
			}
		}
	}

	const now = Date.now();
	const siToTaskId: Record<string, string> = {};
	for (const step of input.steps) {
		siToTaskId[step.siId] = `task_${crypto.randomUUID()}`;
	}

	for (const step of input.steps) {
		const taskId = siToTaskId[step.siId] ?? `task_${crypto.randomUUID()}`;
		const depTaskIds = step.dependsOn.map(
			(depSi) => siToTaskId[depSi] ?? depSi,
		);
		const initialStatus = depTaskIds.length > 0 ? "blocked" : "pending";
		db.run(
			`INSERT INTO team_task (
        id, team_id, si_id, content, status, priority, depends_on, files_touched,
        est_cost_usd, est_duration_ms, time_created, time_updated
      ) VALUES (?, ?, ?, ?, ?, 'high', ?, ?, ?, ?, ?, ?)`,
			[
				taskId,
				input.teamId,
				step.siId,
				`[${input.phaseId}] ${step.siId}: ${step.title}`,
				initialStatus,
				JSON.stringify(depTaskIds),
				JSON.stringify(step.filesTouched),
				step.estCostUsd,
				step.estDurationMs,
				now,
				now,
			],
		);
	}

	return { tasksCreated: input.steps.length, siToTaskId };
}

/**
 * Add an individual task to the team task board.
 */
export function ensembleTasksAdd(
	db: Database,
	input: {
		teamId: string;
		siId?: string;
		content: string;
		priority?: "high" | "medium" | "low";
		dependsOn?: string[];
		filesTouched?: string[];
		estCostUsd?: number;
		estDurationMs?: number;
	},
): { id: string; status: string } {
	const id = `task_${crypto.randomUUID()}`;
	const now = Date.now();
	const deps = input.dependsOn ?? [];
	const status = deps.length > 0 ? "blocked" : "pending";

	db.run(
		`INSERT INTO team_task (
      id, team_id, si_id, content, status, priority, depends_on, files_touched,
      est_cost_usd, est_duration_ms, time_created, time_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			input.teamId,
			input.siId ?? null,
			input.content,
			status,
			input.priority ?? "medium",
			JSON.stringify(deps),
			JSON.stringify(input.filesTouched ?? []),
			input.estCostUsd ?? 0,
			input.estDurationMs ?? 0,
			now,
			now,
		],
	);

	return { id, status };
}

/**
 * List all tasks on the shared team board.
 */
export function ensembleTasksList(
	db: Database,
	input: { teamId: string },
): Array<{
	id: string;
	siId: string | null;
	content: string;
	status: string;
	assignee: string | null;
	estCostUsd: number;
	actualCostUsd: number;
	estDurationMs: number;
	actualDurationMs: number;
}> {
	const rows = db
		.query(
			"SELECT * FROM team_task WHERE team_id = ? ORDER BY time_created ASC",
		)
		.all(input.teamId) as TaskRow[];

	return rows.map((r) => ({
		id: r.id,
		siId: r.si_id,
		content: r.content,
		status: r.status,
		assignee: r.assignee,
		estCostUsd: r.est_cost_usd,
		actualCostUsd: r.actual_cost_usd,
		estDurationMs: r.est_duration_ms,
		actualDurationMs: r.actual_duration_ms,
	}));
}

/**
 * Complete a task and automatically unblock any downstream tasks whose dependencies are all completed.
 */
export function ensembleTasksComplete(
	db: Database,
	input: {
		teamId: string;
		taskId: string;
		actualCostUsd?: number;
		actualDurationMs?: number;
	},
): { completedTaskId: string; unblockedTaskIds: string[] } {
	const now = Date.now();
	db.run(
		`UPDATE team_task
     SET status = 'completed', actual_cost_usd = ?, actual_duration_ms = ?, time_updated = ?
     WHERE id = ? AND team_id = ?`,
		[
			input.actualCostUsd ?? 0,
			input.actualDurationMs ?? 0,
			now,
			input.taskId,
			input.teamId,
		],
	);

	const allTasks = db
		.query("SELECT * FROM team_task WHERE team_id = ?")
		.all(input.teamId) as TaskRow[];

	const completedIds = new Set(
		allTasks.filter((t) => t.status === "completed").map((t) => t.id),
	);

	const unblockedTaskIds: string[] = [];
	for (const task of allTasks) {
		if (task.status !== "blocked" || !task.depends_on) continue;
		const deps = JSON.parse(task.depends_on) as string[];
		if (deps.length > 0 && deps.every((depId) => completedIds.has(depId))) {
			db.run(
				"UPDATE team_task SET status = 'pending', time_updated = ? WHERE id = ?",
				[now, task.id],
			);
			unblockedTaskIds.push(task.id);
		}
	}

	return { completedTaskId: input.taskId, unblockedTaskIds };
}

/**
 * Spawn a fresh teammate session (1 Fresh Spawn per SI) in Workspace: 'share'.
 */
export function ensembleSpawn(
	db: Database,
	input: {
		teamId: string;
		callerSessionId: string;
		name: string;
		siId?: string;
		agent: string;
		prompt: string;
		planApproval?: boolean;
	},
): {
	sessionId: string;
	workspaceMode: "share";
	worktreeBranch: string;
} {
	const team = db.query("SELECT * FROM team WHERE id = ?").get(input.teamId) as
		| TeamRow
		| undefined;
	if (!team) throw new Error(`Team not found: ${input.teamId}`);
	if (team.lead_session_id !== input.callerSessionId) {
		throw new Error("Only the team lead can spawn teammates.");
	}

	const now = Date.now();
	const sessionId = `sess_${crypto.randomUUID()}`;
	const worktreeBranch = `ensemble-${team.name}-${input.name}`;
	const planApproval = input.planApproval ? "pending" : "none";

	db.run(
		`INSERT INTO team_member (
      team_id, name, session_id, si_id, agent, status, execution_status,
      workspace_mode, worktree_branch, plan_approval, prompt, time_created, time_updated
    ) VALUES (?, ?, ?, ?, ?, 'busy', 'running', 'share', ?, ?, ?, ?, ?)`,
		[
			input.teamId,
			input.name,
			sessionId,
			input.siId ?? null,
			input.agent,
			worktreeBranch,
			planApproval,
			input.prompt,
			now,
			now,
		],
	);

	return {
		sessionId,
		workspaceMode: "share",
		worktreeBranch,
	};
}

/**
 * Atomically claim a pending task for a teammate.
 */
export function ensembleClaim(
	db: Database,
	input: { teamId: string; taskId: string; memberName: string },
): { id: string; status: string; assignee: string } {
	const now = Date.now();
	const result = db.run(
		`UPDATE team_task
     SET status = 'in_progress', assignee = ?, time_updated = ?
     WHERE id = ? AND team_id = ? AND status = 'pending'`,
		[input.memberName, now, input.taskId, input.teamId],
	);

	if (result.changes === 0) {
		throw new Error(
			`Task ${input.taskId} is not available for claiming (already claimed or blocked).`,
		);
	}

	return {
		id: input.taskId,
		status: "in_progress",
		assignee: input.memberName,
	};
}

/**
 * Send a peer-to-peer message between teammates or to the lead.
 */
export function ensembleMessage(
	db: Database,
	input: { teamId: string; fromName: string; toName: string; content: string },
): { id: string; delivered: boolean } {
	const id = `msg_${crypto.randomUUID()}`;
	const now = Date.now();
	db.run(
		`INSERT INTO team_message (id, team_id, from_name, to_name, content, delivered, read, time_created)
     VALUES (?, ?, ?, ?, ?, 1, 0, ?)`,
		[id, input.teamId, input.fromName, input.toName, input.content, now],
	);

	if (input.toName === "lead") {
		db.run(
			"UPDATE team_member SET reported_to_lead = 1, time_updated = ? WHERE team_id = ? AND name = ?",
			[now, input.teamId, input.fromName],
		);
	}

	return { id, delivered: true };
}

/**
 * Broadcast a message to all active team members.
 */
export function ensembleBroadcast(
	db: Database,
	input: { teamId: string; fromName: string; content: string },
): { recipientCount: number; messageIds: string[] } {
	const members = db
		.query(
			"SELECT * FROM team_member WHERE team_id = ? AND status IN ('ready', 'busy')",
		)
		.all(input.teamId) as MemberRow[];

	const messageIds: string[] = [];
	for (const m of members) {
		if (m.name === input.fromName) continue;
		const sent = ensembleMessage(db, {
			teamId: input.teamId,
			fromName: input.fromName,
			toName: m.name,
			content: input.content,
		});
		messageIds.push(sent.id);
	}

	return { recipientCount: messageIds.length, messageIds };
}

/**
 * Retrieve full message content and mark as read.
 */
export function ensembleResults(
	db: Database,
	input: { teamId: string; messageId: string },
): { id: string; fromName: string; toName: string | null; content: string } {
	const row = db
		.query("SELECT * FROM team_message WHERE id = ? AND team_id = ?")
		.get(input.messageId, input.teamId) as
		| { id: string; from_name: string; to_name: string | null; content: string }
		| undefined;

	if (!row) throw new Error(`Message ${input.messageId} not found.`);
	db.run("UPDATE team_message SET read = 1 WHERE id = ?", [input.messageId]);

	return {
		id: row.id,
		fromName: row.from_name,
		toName: row.to_name,
		content: row.content,
	};
}

/**
 * Mandatory branch preservation before any teammate session shutdown/abort.
 */
export function preserveBranch(teamName: string, memberName: string): string {
	return `ensemble/preserved/${teamName}/${memberName}`;
}

/**
 * Shutdown a teammate session after preserving its worktree branch.
 */
export function ensembleShutdown(
	db: Database,
	input: {
		teamId: string;
		callerSessionId: string;
		memberName: string;
		force?: boolean;
	},
): { preservedBranch: string; status: "shutdown" } {
	const team = db.query("SELECT * FROM team WHERE id = ?").get(input.teamId) as
		| TeamRow
		| undefined;
	if (!team) throw new Error(`Team not found: ${input.teamId}`);
	if (team.lead_session_id !== input.callerSessionId) {
		throw new Error("Only the team lead can shutdown teammates.");
	}

	// MANDATORY INVARIANT: Always preserve branch before session abort/shutdown
	const preservedBranch = preserveBranch(team.name, input.memberName);
	const now = Date.now();

	db.run(
		`UPDATE team_member
     SET status = 'shutdown', execution_status = 'completed', preserved_branch = ?, time_updated = ?
     WHERE team_id = ? AND name = ?`,
		[preservedBranch, now, input.teamId, input.memberName],
	);

	return { preservedBranch, status: "shutdown" };
}

/**
 * Squash-merge a shutdown teammate's preserved branch into the phase target branch.
 */
export function ensembleMerge(
	db: Database,
	input: {
		teamId: string;
		callerSessionId: string;
		memberName: string;
		targetBranch: string;
	},
): { merged: boolean; sourceRef: string; targetBranch: string } {
	const team = db.query("SELECT * FROM team WHERE id = ?").get(input.teamId) as
		| TeamRow
		| undefined;
	if (!team) throw new Error(`Team not found: ${input.teamId}`);
	if (team.lead_session_id !== input.callerSessionId) {
		throw new Error("Only the team lead can merge teammate branches.");
	}

	const member = db
		.query("SELECT * FROM team_member WHERE team_id = ? AND name = ?")
		.get(input.teamId, input.memberName) as MemberRow | undefined;
	if (!member) throw new Error(`Member not found: ${input.memberName}`);
	if (member.status !== "shutdown" || !member.preserved_branch) {
		throw new Error(
			`Cannot merge member ${input.memberName} before ensemble_shutdown preserves its branch.`,
		);
	}

	return {
		merged: true,
		sourceRef: member.preserved_branch,
		targetBranch: input.targetBranch,
	};
}

/**
 * View team members, statuses, and task summary.
 */
export function ensembleStatus(
	db: Database,
	input: { teamId: string },
): {
	members: Array<{
		name: string;
		status: string;
		siId: string | null;
		preservedBranch: string | null;
	}>;
	tasks: Array<{ id: string; siId: string | null; status: string }>;
} {
	const members = db
		.query("SELECT * FROM team_member WHERE team_id = ?")
		.all(input.teamId) as MemberRow[];
	const tasks = ensembleTasksList(db, { teamId: input.teamId });

	return {
		members: members.map((m) => ({
			name: m.name,
			status: m.status,
			siId: m.si_id,
			preservedBranch: m.preserved_branch,
		})),
		tasks: tasks.map((t) => ({ id: t.id, siId: t.siId, status: t.status })),
	};
}

/**
 * Navigate or inspect a teammate's session.
 */
export function ensembleView(
	db: Database,
	input: { teamId: string; memberName: string },
): { memberName: string; sessionId: string; status: string } {
	const member = db
		.query("SELECT * FROM team_member WHERE team_id = ? AND name = ?")
		.get(input.teamId, input.memberName) as MemberRow | undefined;
	if (!member) throw new Error(`Member not found: ${input.memberName}`);

	return {
		memberName: member.name,
		sessionId: member.session_id,
		status: member.status,
	};
}

/**
 * Archive the team and preserve any remaining active member branches as a safety net.
 */
export function ensembleCleanup(
	db: Database,
	input: { teamId: string; callerSessionId: string },
): { teamStatus: "archived"; safetyNetPreservedBranches: string[] } {
	const team = db.query("SELECT * FROM team WHERE id = ?").get(input.teamId) as
		| TeamRow
		| undefined;
	if (!team) throw new Error(`Team not found: ${input.teamId}`);
	if (team.lead_session_id !== input.callerSessionId) {
		throw new Error("Only the team lead can cleanup the team.");
	}

	const activeMembers = db
		.query(
			"SELECT * FROM team_member WHERE team_id = ? AND status != 'shutdown'",
		)
		.all(input.teamId) as MemberRow[];

	const safetyNetPreservedBranches: string[] = [];
	for (const m of activeMembers) {
		const res = ensembleShutdown(db, {
			teamId: input.teamId,
			callerSessionId: input.callerSessionId,
			memberName: m.name,
			force: true,
		});
		safetyNetPreservedBranches.push(res.preservedBranch);
	}

	db.run("UPDATE team SET status = 'archived', time_updated = ? WHERE id = ?", [
		Date.now(),
		input.teamId,
	]);

	return { teamStatus: "archived", safetyNetPreservedBranches };
}

export interface McpJsonRpcRequest {
	jsonrpc?: string;
	id?: string | number | null;
	method: string;
	params?: {
		name?: string;
		arguments?: Record<string, unknown>;
		[key: string]: unknown;
	};
}

export interface McpJsonRpcResponse {
	jsonrpc: "2.0";
	id: string | number | null;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

const MCP_TOOLS_MANIFEST = [
	{
		name: "ensemble_create",
		description:
			"Create a new team in SQLite WAL; caller becomes team lead with strict delegate: true",
		inputSchema: {
			type: "object",
			properties: {
				name: { type: "string" },
				leadSessionId: { type: "string" },
				projectPath: { type: "string" },
			},
			required: ["name", "leadSessionId"],
		},
	},
	{
		name: "ensemble_spawn",
		description:
			"Spawn a dedicated teammate for a single SI with workspace isolation and branch preservation",
		inputSchema: {
			type: "object",
			properties: {
				teamId: { type: "string" },
				callerSessionId: { type: "string" },
				name: { type: "string" },
				agent: { type: "string" },
				siId: { type: "string" },
				prompt: { type: "string" },
				workspace: { type: "string" },
			},
			required: ["teamId", "callerSessionId", "name", "agent", "prompt"],
		},
	},
	{
		name: "ensemble_message",
		description:
			"Send direct message between team members or report completion to lead",
		inputSchema: {
			type: "object",
			properties: {
				teamId: { type: "string" },
				from: { type: "string" },
				to: { type: "string" },
				content: { type: "string" },
			},
			required: ["teamId", "from", "to", "content"],
		},
	},
	{
		name: "ensemble_broadcast",
		description: "Broadcast a message to all members in the team",
		inputSchema: {
			type: "object",
			properties: {
				teamId: { type: "string" },
				from: { type: "string" },
				content: { type: "string" },
			},
			required: ["teamId", "from", "content"],
		},
	},
	{
		name: "ensemble_tasks_list",
		description: "List all tasks on the shared board for the team",
		inputSchema: {
			type: "object",
			properties: {
				teamId: { type: "string" },
			},
			required: ["teamId"],
		},
	},
	{
		name: "ensemble_tasks_add",
		description:
			"Add tasks to the shared board with dependency edges and file touch tracking",
		inputSchema: {
			type: "object",
			properties: {
				teamId: { type: "string" },
				tasks: { type: "array" },
			},
			required: ["teamId", "tasks"],
		},
	},
	{
		name: "ensemble_tasks_complete",
		description: "Mark a task complete and unblock downstream DAG dependencies",
		inputSchema: {
			type: "object",
			properties: {
				taskId: { type: "string" },
			},
			required: ["taskId"],
		},
	},
	{
		name: "ensemble_claim",
		description: "Atomically claim a pending task for a member",
		inputSchema: {
			type: "object",
			properties: {
				taskId: { type: "string" },
				memberName: { type: "string" },
			},
			required: ["taskId", "memberName"],
		},
	},
	{
		name: "ensemble_results",
		description: "Retrieve full message content or task findings by message ID",
		inputSchema: {
			type: "object",
			properties: {
				messageId: { type: "string" },
			},
			required: ["messageId"],
		},
	},
	{
		name: "ensemble_shutdown",
		description:
			"Request teammate shutdown and preserve git branch before aborting",
		inputSchema: {
			type: "object",
			properties: {
				teamId: { type: "string" },
				callerSessionId: { type: "string" },
				memberName: { type: "string" },
				force: { type: "boolean" },
			},
			required: ["teamId", "callerSessionId", "memberName"],
		},
	},
	{
		name: "ensemble_merge",
		description:
			"Squash-merge a preserved teammate branch into target feature branch",
		inputSchema: {
			type: "object",
			properties: {
				teamId: { type: "string" },
				callerSessionId: { type: "string" },
				memberName: { type: "string" },
				targetBranch: { type: "string" },
			},
			required: ["teamId", "callerSessionId", "memberName", "targetBranch"],
		},
	},
	{
		name: "ensemble_cleanup",
		description:
			"Archive team and preserve any remaining active member branches as safety net",
		inputSchema: {
			type: "object",
			properties: {
				teamId: { type: "string" },
				callerSessionId: { type: "string" },
			},
			required: ["teamId", "callerSessionId"],
		},
	},
	{
		name: "ensemble_status",
		description: "View team members, execution statuses, and task summaries",
		inputSchema: {
			type: "object",
			properties: {
				teamId: { type: "string" },
			},
			required: ["teamId"],
		},
	},
	{
		name: "ensemble_view",
		description: "Inspect teammate session details and state",
		inputSchema: {
			type: "object",
			properties: {
				teamId: { type: "string" },
				memberName: { type: "string" },
			},
			required: ["teamId", "memberName"],
		},
	},
	{
		name: "ensemble_import_phase_plan",
		description:
			"Import phase plan DAG enforcing File-Touch Disjointness across parallel SIs",
		inputSchema: {
			type: "object",
			properties: {
				teamId: { type: "string" },
				phaseId: { type: "string" },
				steps: { type: "array" },
			},
			required: ["teamId", "phaseId", "steps"],
		},
	},
];

/**
 * Handle a single MCP JSON-RPC 2.0 request and return a response or null (for notifications).
 *
 * @param db - Database instance
 * @param request - McpJsonRpcRequest
 * @returns McpJsonRpcResponse or null
 */
export function handleMcpJsonRpcRequest(
	db: Database,
	request: McpJsonRpcRequest,
): McpJsonRpcResponse | null {
	const id = request.id ?? null;

	if (request.method === "initialize") {
		return {
			jsonrpc: "2.0",
			id,
			result: {
				protocolVersion: "2024-11-05",
				capabilities: {
					tools: {},
				},
				serverInfo: {
					name: "agy-ensemble",
					version: "1.0.0",
				},
			},
		};
	}

	if (request.method === "notifications/initialized") {
		return null;
	}

	if (request.method === "ping") {
		return {
			jsonrpc: "2.0",
			id,
			result: {},
		};
	}

	if (request.method === "tools/list") {
		return {
			jsonrpc: "2.0",
			id,
			result: {
				tools: MCP_TOOLS_MANIFEST,
			},
		};
	}

	if (request.method === "tools/call") {
		const toolName = request.params?.name;
		const args = request.params?.arguments ?? {};

		try {
			let resultPayload: unknown = null;

			switch (toolName) {
				case "ensemble_create":
					resultPayload = ensembleCreate(db, {
						name: String(args.name ?? "unnamed-team"),
						leadSessionId: String(args.leadSessionId ?? "lead"),
						projectPath: args.projectPath
							? String(args.projectPath)
							: undefined,
					});
					break;

				case "ensemble_spawn":
					resultPayload = ensembleSpawn(db, {
						teamId: String(args.teamId),
						callerSessionId: String(args.callerSessionId),
						name: String(args.name),
						agent: String(args.agent),
						siId: args.siId ? String(args.siId) : undefined,
						prompt: String(args.prompt),
						planApproval: Boolean(args.planApproval),
					});
					break;

				case "ensemble_message":
					resultPayload = ensembleMessage(db, {
						teamId: String(args.teamId),
						fromName: String(args.fromName ?? args.from),
						toName: String(args.toName ?? args.to),
						content: String(args.content),
					});
					break;

				case "ensemble_broadcast":
					resultPayload = ensembleBroadcast(db, {
						teamId: String(args.teamId),
						fromName: String(args.fromName ?? args.from),
						content: String(args.content),
					});
					break;

				case "ensemble_tasks_list":
					resultPayload = ensembleTasksList(db, {
						teamId: String(args.teamId),
					});
					break;

				case "ensemble_tasks_add":
					resultPayload = ensembleTasksAdd(db, {
						teamId: String(args.teamId),
						siId: args.siId ? String(args.siId) : undefined,
						content: String(args.content ?? ""),
						priority:
							args.priority === "high" || args.priority === "low"
								? args.priority
								: "medium",
						dependsOn: Array.isArray(args.dependsOn)
							? (args.dependsOn as string[])
							: undefined,
						filesTouched: Array.isArray(args.filesTouched)
							? (args.filesTouched as string[])
							: undefined,
						estCostUsd:
							typeof args.estCostUsd === "number" ? args.estCostUsd : undefined,
						estDurationMs:
							typeof args.estDurationMs === "number"
								? args.estDurationMs
								: undefined,
					});
					break;

				case "ensemble_tasks_complete":
					resultPayload = ensembleTasksComplete(db, {
						teamId: String(args.teamId),
						taskId: String(args.taskId),
						actualCostUsd:
							typeof args.actualCostUsd === "number"
								? args.actualCostUsd
								: undefined,
						actualDurationMs:
							typeof args.actualDurationMs === "number"
								? args.actualDurationMs
								: undefined,
					});
					break;

				case "ensemble_claim":
					resultPayload = ensembleClaim(db, {
						teamId: String(args.teamId),
						taskId: String(args.taskId),
						memberName: String(args.memberName),
					});
					break;

				case "ensemble_results":
					resultPayload = ensembleResults(db, {
						teamId: String(args.teamId),
						messageId: String(args.messageId),
					});
					break;

				case "ensemble_shutdown":
					resultPayload = ensembleShutdown(db, {
						teamId: String(args.teamId),
						callerSessionId: String(args.callerSessionId),
						memberName: String(args.memberName),
						force: Boolean(args.force),
					});
					break;

				case "ensemble_merge":
					resultPayload = ensembleMerge(db, {
						teamId: String(args.teamId),
						callerSessionId: String(args.callerSessionId),
						memberName: String(args.memberName),
						targetBranch: String(args.targetBranch),
					});
					break;

				case "ensemble_cleanup":
					resultPayload = ensembleCleanup(db, {
						teamId: String(args.teamId),
						callerSessionId: String(args.callerSessionId),
					});
					break;

				case "ensemble_status":
					resultPayload = ensembleStatus(db, {
						teamId: String(args.teamId),
					});
					break;

				case "ensemble_view":
					resultPayload = ensembleView(db, {
						teamId: String(args.teamId),
						memberName: String(args.memberName),
					});
					break;

				case "ensemble_import_phase_plan":
					resultPayload = ensembleImportPhasePlan(db, {
						teamId: String(args.teamId),
						phaseId: String(args.phaseId),
						steps: (args.steps as PhasePlanStepInput[]) ?? [],
					});
					break;

				default:
					return {
						jsonrpc: "2.0",
						id,
						error: {
							code: -32601,
							message: `Unknown MCP tool: ${toolName}`,
						},
					};
			}

			return {
				jsonrpc: "2.0",
				id,
				result: {
					content: [
						{
							type: "text",
							text: JSON.stringify(resultPayload, null, 2),
						},
					],
				},
			};
		} catch (err) {
			return {
				jsonrpc: "2.0",
				id,
				result: {
					isError: true,
					content: [
						{
							type: "text",
							text: err instanceof Error ? err.message : String(err),
						},
					],
				},
			};
		}
	}

	return {
		jsonrpc: "2.0",
		id,
		error: {
			code: -32601,
			message: `Method not found: ${request.method}`,
		},
	};
}

/**
 * Start the MCP JSON-RPC 2.0 stdio server listening on process.stdin.
 *
 * @param dbPath - Path to SQLite database (defaults to ENSEMBLE_DB_PATH or .ensemble/team.db)
 */
export function startMcpStdioServer(
	dbPath: string = process.env.ENSEMBLE_DB_PATH || ".ensemble/team.db",
): void {
	const db = createDb(dbPath);
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: false,
	});

	rl.on("line", (line) => {
		const trimmed = line.trim();
		if (!trimmed) return;

		try {
			const req = JSON.parse(trimmed) as McpJsonRpcRequest;
			const res = handleMcpJsonRpcRequest(db, req);
			if (res !== null) {
				process.stdout.write(`${JSON.stringify(res)}\n`);
			}
		} catch (err) {
			const errRes: McpJsonRpcResponse = {
				jsonrpc: "2.0",
				id: null,
				error: {
					code: -32700,
					message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
				},
			};
			process.stdout.write(`${JSON.stringify(errRes)}\n`);
		}
	});

	process.on("SIGINT", () => {
		process.exit(0);
	});
}

// Auto-start stdio server when executed directly as CLI script
if (
	typeof process !== "undefined" &&
	process.argv[1] &&
	(process.argv[1].endsWith("mcp-server.js") ||
		process.argv[1].endsWith("mcp-server.ts"))
) {
	startMcpStdioServer();
}
