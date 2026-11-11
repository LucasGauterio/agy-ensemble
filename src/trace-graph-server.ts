import fs from "node:fs";
import http, {
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Database } from "./db";
import { calculatePhaseFinOpsSummary } from "./finops";

interface TraceNodeRow {
	id: string;
	team_id: string;
	parent_id: string | null;
	zoom_level: number;
	node_kind: string;
	label: string;
	agent_name: string | null;
	si_id: string | null;
	status: string;
	est_cost_usd: number;
	actual_cost_usd: number;
	est_duration_ms: number;
	actual_duration_ms: number;
	input_tokens: number;
	output_tokens: number;
	payload_json: string | null;
	time_started: number;
	time_completed: number | null;
}

interface TeamSummaryRow {
	id: string;
	name: string;
	project_id: string;
	status: string;
	delegate: number;
	time_created: number;
	time_updated: number;
}

export interface TraceProjectEntry {
	projectDir: string;
	projectName: string;
	dbPath: string;
	dbExists: boolean;
	updatedAt: number;
	pid?: number;
}

export interface TraceSnapshot {
	hasData: boolean;
	dbExists: boolean;
	activeProjectDir?: string;
	activeDbPath?: string;
	projects?: TraceProjectEntry[];
	team: TeamSummaryRow | null;
	teams: TeamSummaryRow[];
	zoomLevel: 1 | 2 | 3;
	finops: {
		totalEstCostUsd: number;
		totalActualCostUsd: number;
		totalEstDurationMs: number;
		totalActualDurationMs: number;
		costDeltaPct: number;
		durationDeltaPct: number;
	};
	levelCounts: {
		level1: number;
		level2: number;
		level3: number;
	};
	nodes: Array<{
		id: string;
		parentId: string | null;
		label: string;
		nodeKind: string;
		status: string;
		siId: string | null;
		agentName: string | null;
		estCostUsd: number;
		actualCostUsd: number;
		estDurationMs: number;
		actualDurationMs: number;
		timeStarted: number;
		timeCompleted: number | null;
	}>;
	edges: Array<{
		id: string;
		sourceId: string;
		targetId: string;
		edgeKind: string;
	}>;
	tasks: Array<{
		id: string;
		siId: string | null;
		content: string;
		status: string;
		priority: string;
		assignee: string | null;
		estCostUsd: number;
		actualCostUsd: number;
		estDurationMs: number;
		actualDurationMs: number;
	}>;
	members: Array<{
		name: string;
		siId: string | null;
		agent: string;
		status: string;
		executionStatus: string;
		worktreeBranch: string | null;
		preservedBranch: string | null;
	}>;
	messages: Array<{
		id: string;
		fromName: string;
		toName: string | null;
		content: string;
		timeCreated: number;
	}>;
	timeRange: {
		minStarted: number;
		maxTime: number;
	};
}

export interface TraceInspectorDetails {
	spanId: string;
	teamId: string;
	zoomLevel: number;
	nodeKind: string;
	label: string;
	status: string;
	siId: string | null;
	agentName: string | null;
	timeStarted: number;
	timeCompleted: number | null;
	tabs: string[];
	payload: unknown;
	finops: {
		estCostUsd: number;
		actualCostUsd: number;
		estDurationMs: number;
		actualDurationMs: number;
		inputTokens: number;
		outputTokens: number;
	};
}

export interface TraceGraphServerHandle {
	server: Server;
	port: number;
	url: string;
	close: () => Promise<void>;
}

export interface ResilientTraceServerHandle {
	port: number;
	url: string;
	isOwner: () => boolean;
	close: () => Promise<void>;
}

/**
 * Resolve the shared trace project registry JSON path.
 */
export function getTraceRegistryPath(override?: string): string {
	if (override && override.trim().length > 0) return path.resolve(override);
	if (
		process.env.AGY_ENSEMBLE_TRACE_REGISTRY &&
		process.env.AGY_ENSEMBLE_TRACE_REGISTRY.trim().length > 0
	) {
		return path.resolve(process.env.AGY_ENSEMBLE_TRACE_REGISTRY);
	}
	return path.join(os.homedir(), ".agy-ensemble", "trace-registry.json");
}

/**
 * Derive project root directory from an ensemble SQLite path (<project>/.ensemble/team.db).
 */
export function resolveProjectDirFromDbPath(dbPath: string): string {
	const resolved = path.resolve(dbPath);
	const parent = path.dirname(resolved);
	if (
		path.basename(resolved) === "team.db" &&
		path.basename(parent) === ".ensemble"
	) {
		return path.dirname(parent);
	}
	return parent;
}

/**
 * Register or refresh a project's trace DB entry in the shared registry.
 */
export function registerTraceProject(input: {
	dbPath: string;
	projectDir?: string;
	pid?: number;
	registryPath?: string;
}): TraceProjectEntry[] {
	if (input.dbPath === ":memory:" || input.dbPath.startsWith("file:")) {
		return [];
	}
	const registryPath = getTraceRegistryPath(input.registryPath);
	const resolvedDb = path.resolve(input.dbPath);
	const resolvedProject = path.resolve(
		input.projectDir ?? resolveProjectDirFromDbPath(resolvedDb),
	);

	let entries: TraceProjectEntry[] = [];
	if (fs.existsSync(registryPath)) {
		try {
			const parsed = JSON.parse(fs.readFileSync(registryPath, "utf8"));
			if (Array.isArray(parsed)) {
				entries = parsed.filter(
					(e): e is TraceProjectEntry =>
						Boolean(e && typeof e.dbPath === "string"),
				);
			}
		} catch {
			entries = [];
		}
	}

	const filtered = entries.filter(
		(e) => path.resolve(e.dbPath) !== resolvedDb,
	);
	const nextEntry: TraceProjectEntry = {
		projectDir: resolvedProject,
		projectName: path.basename(resolvedProject) || resolvedProject,
		dbPath: resolvedDb,
		dbExists: fs.existsSync(resolvedDb),
		updatedAt: Date.now(),
		pid: input.pid,
	};
	const updated = [nextEntry, ...filtered].slice(0, 20);

	try {
		fs.mkdirSync(path.dirname(registryPath), { recursive: true });
		fs.writeFileSync(
			registryPath,
			`${JSON.stringify(updated, null, 2)}\n`,
			"utf8",
		);
	} catch {
		// Registry write must never interrupt MCP or hook execution
	}

	return updated;
}

/**
 * List registered projects from the shared trace registry, sorted by most recently active.
 */
export function listTraceProjects(registryPath?: string): TraceProjectEntry[] {
	const target = getTraceRegistryPath(registryPath);
	if (!fs.existsSync(target)) return [];

	try {
		const parsed = JSON.parse(fs.readFileSync(target, "utf8"));
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(
				(e): e is TraceProjectEntry =>
					Boolean(
						e &&
							typeof e.dbPath === "string" &&
							typeof e.projectDir === "string" &&
							fs.existsSync(e.projectDir),
					),
			)
			.map((e) => ({
				...e,
				projectName: e.projectName || path.basename(e.projectDir),
				dbExists: fs.existsSync(e.dbPath),
			}))
			.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
	} catch {
		return [];
	}
}

function resolveRequestedDbPath(
	defaultDbPath: string,
	requestedProjectOrDb?: string,
	registryPath?: string,
): string {
	if (requestedProjectOrDb) {
		const candidate = requestedProjectOrDb.endsWith(".db")
			? path.resolve(requestedProjectOrDb)
			: path.resolve(requestedProjectOrDb, ".ensemble", "team.db");
		return candidate;
	}

	const projects = listTraceProjects(registryPath);
	const latestWithDb = projects.find((p) => p.dbExists);

	if (fs.existsSync(defaultDbPath)) {
		// If default DB matches a registered project, prefer most recently active DB if another project was updated more recently
		if (
			latestWithDb &&
			path.resolve(latestWithDb.dbPath) !== path.resolve(defaultDbPath)
		) {
			const defaultStat = fs.statSync(defaultDbPath).mtimeMs;
			const latestStat = fs.statSync(latestWithDb.dbPath).mtimeMs;
			if (latestStat > defaultStat + 1000) {
				return latestWithDb.dbPath;
			}
		}
		return defaultDbPath;
	}

	return latestWithDb ? latestWithDb.dbPath : defaultDbPath;
}

/**
 * Probe whether a healthy agy-ensemble trace server is already listening on host:port.
 */
export function isTraceServerHealthy(
	port = 4141,
	host = "127.0.0.1",
): Promise<boolean> {
	return new Promise((resolve) => {
		const req = http.get(
			{
				host,
				port,
				path: "/api/trace/health",
				timeout: 350,
			},
			(res) => {
				let body = "";
				res.setEncoding("utf8");
				res.on("data", (chunk) => {
					body += chunk;
				});
				res.on("end", () => {
					try {
						const parsed = JSON.parse(body) as { service?: string };
						resolve(res.statusCode === 200 && parsed.service === "trace-graph");
					} catch {
						resolve(false);
					}
				});
			},
		);
		req.on("timeout", () => {
			req.destroy();
			resolve(false);
		});
		req.on("error", () => resolve(false));
	});
}

/**
 * Build the 3-level Semantic Zoom DAG payload (Level 1: Macro Pipeline, Level 2: Meso SI DAG, Level 3: Micro Tool Spans)
 * supporting optional Time-Travel Scrub Bar filtering via maxTimestampMs.
 */
export function buildSemanticZoomGraphPayload(
	db: Database,
	input: { teamId: string; zoomLevel: 1 | 2 | 3; maxTimestampMs?: number },
): {
	zoomLevel: 1 | 2 | 3;
	nodes: Array<{
		id: string;
		label: string;
		nodeKind: string;
		status: string;
		siId: string | null;
		agentName: string | null;
		estCostUsd: number;
		actualCostUsd: number;
		estDurationMs: number;
		actualDurationMs: number;
	}>;
	edges: Array<{
		id: string;
		sourceId: string;
		targetId: string;
		edgeKind: string;
	}>;
} {
	const nodesRaw = db
		.query(
			"SELECT * FROM trace_nodes WHERE team_id = ? AND zoom_level = ? ORDER BY time_started ASC",
		)
		.all(input.teamId, input.zoomLevel) as TraceNodeRow[];

	const filtered =
		typeof input.maxTimestampMs === "number"
			? nodesRaw.filter(
					(n) =>
						n.time_started <= (input.maxTimestampMs ?? Number.MAX_SAFE_INTEGER),
				)
			: nodesRaw;

	const edgesRaw = db
		.query("SELECT * FROM trace_edges WHERE team_id = ?")
		.all(input.teamId) as Array<{
		id: string;
		source_id: string;
		target_id: string;
		edge_kind: string;
	}>;

	return {
		zoomLevel: input.zoomLevel,
		nodes: filtered.map((n) => ({
			id: n.id,
			label: n.label,
			nodeKind: n.node_kind,
			status: n.status,
			siId: n.si_id,
			agentName: n.agent_name,
			estCostUsd: n.est_cost_usd,
			actualCostUsd: n.actual_cost_usd,
			estDurationMs: n.est_duration_ms,
			actualDurationMs: n.actual_duration_ms,
		})),
		edges: edgesRaw.map((e) => ({
			id: e.id,
			sourceId: e.source_id,
			targetId: e.target_id,
			edgeKind: e.edge_kind,
		})),
	};
}

/**
 * Retrieve the 4-tab Inspector Drawer payload for any clicked node in the Trace Graph UI.
 */
export function getInspectorDrawerData(
	db: Database,
	spanId: string,
): {
	spanId: string;
	label: string;
	status: string;
	tabs: string[];
	finops: {
		estCostUsd: number;
		actualCostUsd: number;
		estDurationMs: number;
		actualDurationMs: number;
		inputTokens: number;
		outputTokens: number;
	};
} {
	const row = db.query("SELECT * FROM trace_nodes WHERE id = ?").get(spanId) as
		| TraceNodeRow
		| undefined;

	if (!row) throw new Error(`Trace span not found: ${spanId}`);

	return {
		spanId: row.id,
		label: row.label,
		status: row.status,
		tabs: [
			"Prompt & Context",
			"Diff & Files",
			"Tests & Quality Gate",
			"Logs & Telemetry",
		],
		finops: {
			estCostUsd: row.est_cost_usd,
			actualCostUsd: row.actual_cost_usd,
			estDurationMs: row.est_duration_ms,
			actualDurationMs: row.actual_duration_ms,
			inputTokens: row.input_tokens,
			outputTokens: row.output_tokens,
		},
	};
}

/**
 * Retrieve rich node metadata & parsed payload for the interactive Trace Inspector.
 */
export function getInspectorNodeDetails(
	db: Database,
	spanId: string,
): TraceInspectorDetails {
	if (spanId.startsWith("task:")) {
		const taskId = spanId.slice("task:".length);
		const taskRow = db
			.query(
				`SELECT id, team_id, si_id, content, status, assignee, est_cost_usd, actual_cost_usd, est_duration_ms, actual_duration_ms, time_created, time_updated
         FROM team_task WHERE id = ?`,
			)
			.get(taskId) as
			| {
					id: string;
					team_id: string;
					si_id: string | null;
					content: string;
					status: string;
					assignee: string | null;
					est_cost_usd: number;
					actual_cost_usd: number;
					est_duration_ms: number;
					actual_duration_ms: number;
					time_created: number;
					time_updated: number;
			  }
			| undefined;
		if (!taskRow) throw new Error(`Trace span not found: ${spanId}`);
		return {
			spanId,
			teamId: taskRow.team_id,
			zoomLevel: 2,
			nodeKind: "SI_TASK",
			label: taskRow.content || taskRow.si_id || taskRow.id,
			status: taskRow.status,
			siId: taskRow.si_id,
			agentName: taskRow.assignee,
			timeStarted: taskRow.time_created,
			timeCompleted: taskRow.time_updated,
			tabs: [
				"Prompt & Context",
				"Diff & Files",
				"Tests & Quality Gate",
				"Logs & Telemetry",
			],
			payload: {
				taskId: taskRow.id,
				siId: taskRow.si_id,
				content: taskRow.content,
				assignee: taskRow.assignee,
			},
			finops: {
				estCostUsd: taskRow.est_cost_usd,
				actualCostUsd: taskRow.actual_cost_usd,
				estDurationMs: taskRow.est_duration_ms,
				actualDurationMs: taskRow.actual_duration_ms,
				inputTokens: 0,
				outputTokens: 0,
			},
		};
	}

	const base = getInspectorDrawerData(db, spanId);
	const row = db.query("SELECT * FROM trace_nodes WHERE id = ?").get(spanId) as
		| TraceNodeRow
		| undefined;
	if (!row) throw new Error(`Trace span not found: ${spanId}`);

	let parsedPayload: unknown = {};
	if (row.payload_json) {
		try {
			parsedPayload = JSON.parse(row.payload_json);
		} catch {
			parsedPayload = row.payload_json;
		}
	}

	return {
		...base,
		teamId: row.team_id,
		zoomLevel: row.zoom_level,
		nodeKind: row.node_kind,
		siId: row.si_id,
		agentName: row.agent_name,
		timeStarted: row.time_started,
		timeCompleted: row.time_completed,
		payload: parsedPayload,
	};
}

/**
 * Format a Server-Sent Event (SSE) frame for GET /api/trace/stream.
 */
export function formatSseTraceEvent(
	eventName: string,
	payload: unknown,
): string {
	return `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function emptyTraceSnapshot(
	zoomLevel: 1 | 2 | 3,
	dbExists: boolean,
): TraceSnapshot {
	return {
		hasData: false,
		dbExists,
		team: null,
		teams: [],
		zoomLevel,
		finops: {
			totalEstCostUsd: 0,
			totalActualCostUsd: 0,
			totalEstDurationMs: 0,
			totalActualDurationMs: 0,
			costDeltaPct: 0,
			durationDeltaPct: 0,
		},
		levelCounts: { level1: 0, level2: 0, level3: 0 },
		nodes: [],
		edges: [],
		tasks: [],
		members: [],
		messages: [],
		timeRange: { minStarted: 0, maxTime: 0 },
	};
}

/**
 * Build a complete live snapshot of trace spans, tasks, members, messages, and FinOps totals.
 */
export function buildTraceSnapshot(
	db: Database,
	options: {
		teamId?: string;
		zoomLevel?: 1 | 2 | 3;
		maxTimestampMs?: number;
	} = {},
): TraceSnapshot {
	const zoomLevel: 1 | 2 | 3 = options.zoomLevel ?? 2;
	const teams = db
		.query(
			"SELECT id, name, project_id, status, delegate, time_created, time_updated FROM team ORDER BY time_created DESC",
		)
		.all() as TeamSummaryRow[];

	if (teams.length === 0) {
		return emptyTraceSnapshot(zoomLevel, true);
	}

	const activeTeam =
		(options.teamId ? teams.find((t) => t.id === options.teamId) : undefined) ??
		teams[0];
	if (!activeTeam) {
		return emptyTraceSnapshot(zoomLevel, true);
	}

	const allNodes = db
		.query(
			"SELECT * FROM trace_nodes WHERE team_id = ? ORDER BY time_started ASC",
		)
		.all(activeTeam.id) as TraceNodeRow[];

	const levelCounts = {
		level1: allNodes.filter((n) => n.zoom_level === 1).length,
		level2: allNodes.filter((n) => n.zoom_level === 2).length,
		level3: allNodes.filter((n) => n.zoom_level === 3).length,
	};

	const levelNodes = allNodes.filter((n) => n.zoom_level === zoomLevel);
	const filteredNodes =
		typeof options.maxTimestampMs === "number"
			? levelNodes.filter(
					(n) =>
						n.time_started <=
						(options.maxTimestampMs ?? Number.MAX_SAFE_INTEGER),
				)
			: levelNodes;

	const edgesRaw = db
		.query("SELECT id, source_id, target_id, edge_kind FROM trace_edges WHERE team_id = ?")
		.all(activeTeam.id) as Array<{
		id: string;
		source_id: string;
		target_id: string;
		edge_kind: string;
	}>;

	const tasksRaw = db
		.query(
			`SELECT id, si_id, content, status, priority, assignee, est_cost_usd, actual_cost_usd, est_duration_ms, actual_duration_ms
       FROM team_task WHERE team_id = ? ORDER BY time_created ASC`,
		)
		.all(activeTeam.id) as Array<{
		id: string;
		si_id: string | null;
		content: string;
		status: string;
		priority: string;
		assignee: string | null;
		est_cost_usd: number;
		actual_cost_usd: number;
		est_duration_ms: number;
		actual_duration_ms: number;
	}>;

	const membersRaw = db
		.query(
			`SELECT name, si_id, agent, status, execution_status, worktree_branch, preserved_branch
       FROM team_member WHERE team_id = ? ORDER BY time_created ASC`,
		)
		.all(activeTeam.id) as Array<{
		name: string;
		si_id: string | null;
		agent: string;
		status: string;
		execution_status: string;
		worktree_branch: string | null;
		preserved_branch: string | null;
	}>;

	const messagesRaw = db
		.query(
			`SELECT id, from_name, to_name, content, time_created
       FROM team_message WHERE team_id = ? ORDER BY time_created DESC LIMIT 30`,
		)
		.all(activeTeam.id) as Array<{
		id: string;
		from_name: string;
		to_name: string | null;
		content: string;
		time_created: number;
	}>;

	let minStarted = 0;
	let maxTime = 0;
	for (const node of allNodes) {
		if (minStarted === 0 || node.time_started < minStarted) {
			minStarted = node.time_started;
		}
		const endTs = node.time_completed ?? node.time_started;
		if (endTs > maxTime) maxTime = endTs;
	}

	const mappedNodes =
		filteredNodes.length > 0
			? filteredNodes.map((n) => ({
					id: n.id,
					parentId: n.parent_id,
					label: n.label,
					nodeKind: n.node_kind,
					status: n.status,
					siId: n.si_id,
					agentName: n.agent_name,
					estCostUsd: n.est_cost_usd,
					actualCostUsd: n.actual_cost_usd,
					estDurationMs: n.est_duration_ms,
					actualDurationMs: n.actual_duration_ms,
					timeStarted: n.time_started,
					timeCompleted: n.time_completed,
				}))
			: allNodes.length === 0 && zoomLevel === 2 && tasksRaw.length > 0
				? tasksRaw
						.filter((t) => t.si_id || t.content)
						.map((t) => ({
							id: `task:${t.id}`,
							parentId: null,
							label: t.content || t.si_id || t.id,
							nodeKind: "SI_TASK",
							status: t.status,
							siId: t.si_id,
							agentName: t.assignee,
							estCostUsd: t.est_cost_usd,
							actualCostUsd: t.actual_cost_usd,
							estDurationMs: t.est_duration_ms,
							actualDurationMs: t.actual_duration_ms,
							timeStarted: activeTeam.time_created,
							timeCompleted: activeTeam.time_updated,
						}))
				: [];

	return {
		hasData: allNodes.length > 0 || tasksRaw.length > 0 || membersRaw.length > 0,
		dbExists: true,
		team: activeTeam,
		teams,
		zoomLevel,
		finops: calculatePhaseFinOpsSummary(db, activeTeam.id),
		levelCounts,
		nodes: mappedNodes,
		edges: edgesRaw.map((e) => ({
			id: e.id,
			sourceId: e.source_id,
			targetId: e.target_id,
			edgeKind: e.edge_kind,
		})),
		tasks: tasksRaw.map((t) => ({
			id: t.id,
			siId: t.si_id,
			content: t.content,
			status: t.status,
			priority: t.priority,
			assignee: t.assignee,
			estCostUsd: t.est_cost_usd,
			actualCostUsd: t.actual_cost_usd,
			estDurationMs: t.est_duration_ms,
			actualDurationMs: t.actual_duration_ms,
		})),
		members: membersRaw.map((m) => ({
			name: m.name,
			siId: m.si_id,
			agent: m.agent,
			status: m.status,
			executionStatus: m.execution_status,
			worktreeBranch: m.worktree_branch,
			preservedBranch: m.preserved_branch,
		})),
		messages: messagesRaw.map((msg) => ({
			id: msg.id,
			fromName: msg.from_name,
			toName: msg.to_name,
			content: msg.content,
			timeCreated: msg.time_created,
		})),
		timeRange: { minStarted, maxTime },
	};
}

/**
 * Safely read a trace snapshot from a SQLite file path without creating the DB if missing.
 */
export function readTraceSnapshotFromFile(
	dbPath: string,
	options: {
		teamId?: string;
		zoomLevel?: 1 | 2 | 3;
		maxTimestampMs?: number;
	} = {},
): TraceSnapshot {
	const zoomLevel: 1 | 2 | 3 = options.zoomLevel ?? 2;
	if (!fs.existsSync(dbPath)) {
		return emptyTraceSnapshot(zoomLevel, false);
	}
	const db = createDb(dbPath);
	try {
		return buildTraceSnapshot(db, options);
	} finally {
		db.close();
	}
}

/**
 * Safely read detailed node inspector data from a SQLite file path.
 */
export function readTraceNodeFromFile(
	dbPath: string,
	spanId: string,
): TraceInspectorDetails {
	if (!fs.existsSync(dbPath)) {
		throw new Error("Trace database has not been created yet.");
	}
	const db = createDb(dbPath);
	try {
		return getInspectorNodeDetails(db, spanId);
	} finally {
		db.close();
	}
}

/**
 * Resolve the path to sidecars/trace-graph/web/index.html relative to module root.
 */
export function resolveTraceHtmlPath(): string {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.resolve(here, "..", "sidecars", "trace-graph", "web", "index.html"),
		path.resolve(here, "sidecars", "trace-graph", "web", "index.html"),
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return candidates[0] ?? "sidecars/trace-graph/web/index.html";
}

function parseZoomParam(raw: string | null): 1 | 2 | 3 {
	if (raw === "1") return 1;
	if (raw === "3") return 3;
	return 2;
}

function parseOptionalNumber(raw: string | null): number | undefined {
	if (!raw) return undefined;
	const parsed = Number.parseInt(raw, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function writeJsonResponse(
	res: ServerResponse,
	status: number,
	payload: unknown,
): void {
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "no-store",
	});
	res.end(JSON.stringify(payload));
}

function readTraceFingerprint(
	dbPath: string,
	teamId?: string,
): { fingerprint: string; snapshot: TraceSnapshot } {
	const snapshot = readTraceSnapshotFromFile(dbPath, {
		teamId,
		zoomLevel: 2,
	});
	const fingerprint = JSON.stringify({
		hasData: snapshot.hasData,
		teamId: snapshot.team?.id ?? null,
		counts: snapshot.levelCounts,
		nodes: snapshot.nodes.map((n) => `${n.id}:${n.status}:${n.actualCostUsd}`),
		tasks: snapshot.tasks.map((t) => `${t.id}:${t.status}`),
		members: snapshot.members.map((m) => `${m.name}:${m.status}:${m.executionStatus}`),
		msgLen: snapshot.messages.length,
	});
	return { fingerprint, snapshot };
}

/**
 * Start the standalone Mission Control Trace Graph HTTP + SSE server.
 */
export async function startTraceGraphServer(options: {
	dbPath: string;
	port?: number;
	host?: string;
	htmlPath?: string;
	registryPath?: string;
}): Promise<TraceGraphServerHandle> {
	const host = options.host ?? "127.0.0.1";
	const port = options.port ?? 4141;
	const htmlPath = options.htmlPath ?? resolveTraceHtmlPath();
	const registryPath = options.registryPath;

	if (options.dbPath !== ":memory:") {
		registerTraceProject({ dbPath: options.dbPath, registryPath });
	}

	const sseClients = new Set<{
		res: ServerResponse;
		dbPath: string;
		teamId?: string;
		zoomLevel: 1 | 2 | 3;
		maxTimestampMs?: number;
		lastFingerprint: string;
	}>();

	const readEnrichedSnapshot = (params: {
		requestedProjectOrDb?: string;
		teamId?: string;
		zoomLevel: 1 | 2 | 3;
		maxTimestampMs?: number;
	}): { dbPath: string; snapshot: TraceSnapshot } => {
		const activeDbPath = resolveRequestedDbPath(
			options.dbPath,
			params.requestedProjectOrDb,
			registryPath,
		);
		const snap = readTraceSnapshotFromFile(activeDbPath, {
			teamId: params.teamId,
			zoomLevel: params.zoomLevel,
			maxTimestampMs: params.maxTimestampMs,
		});
		const projects = listTraceProjects(registryPath);
		const activeProjectDir = resolveProjectDirFromDbPath(activeDbPath);
		return {
			dbPath: activeDbPath,
			snapshot: {
				...snap,
				activeDbPath,
				activeProjectDir,
				projects,
			},
		};
	};

	const handleRequest = (req: IncomingMessage, res: ServerResponse): void => {
		const url = new URL(req.url ?? "/", `http://${host}:${port}`);

		if (url.pathname === "/api/trace/health") {
			const activeDbPath = resolveRequestedDbPath(
				options.dbPath,
				url.searchParams.get("projectDir") ||
					url.searchParams.get("dbPath") ||
					undefined,
				registryPath,
			);
			writeJsonResponse(res, 200, {
				status: "ok",
				service: "trace-graph",
				dbExists: fs.existsSync(activeDbPath),
				dbPath: activeDbPath,
				projectsCount: listTraceProjects(registryPath).length,
			});
			return;
		}

		if (url.pathname === "/api/trace/projects") {
			writeJsonResponse(res, 200, {
				projects: listTraceProjects(registryPath),
			});
			return;
		}

		if (url.pathname === "/api/trace/state") {
			const requestedProjectOrDb =
				url.searchParams.get("projectDir") ||
				url.searchParams.get("dbPath") ||
				undefined;
			const teamId = url.searchParams.get("teamId") || undefined;
			const zoomLevel = parseZoomParam(url.searchParams.get("zoom"));
			const maxTimestampMs = parseOptionalNumber(
				url.searchParams.get("maxTs"),
			);
			try {
				const { snapshot } = readEnrichedSnapshot({
					requestedProjectOrDb,
					teamId,
					zoomLevel,
					maxTimestampMs,
				});
				writeJsonResponse(res, 200, snapshot);
			} catch (err) {
				writeJsonResponse(res, 500, {
					error: err instanceof Error ? err.message : String(err),
				});
			}
			return;
		}

		if (url.pathname === "/api/trace/node") {
			const spanId = url.searchParams.get("spanId");
			if (!spanId) {
				writeJsonResponse(res, 400, { error: "Missing spanId query parameter." });
				return;
			}
			const requestedProjectOrDb =
				url.searchParams.get("projectDir") ||
				url.searchParams.get("dbPath") ||
				undefined;
			const activeDbPath = resolveRequestedDbPath(
				options.dbPath,
				requestedProjectOrDb,
				registryPath,
			);
			try {
				const details = readTraceNodeFromFile(activeDbPath, spanId);
				writeJsonResponse(res, 200, details);
			} catch (err) {
				writeJsonResponse(res, 404, {
					error: err instanceof Error ? err.message : String(err),
				});
			}
			return;
		}

		if (url.pathname === "/api/trace/stream") {
			const requestedProjectOrDb =
				url.searchParams.get("projectDir") ||
				url.searchParams.get("dbPath") ||
				undefined;
			const teamId = url.searchParams.get("teamId") || undefined;
			const zoomLevel = parseZoomParam(url.searchParams.get("zoom"));
			const maxTimestampMs = parseOptionalNumber(
				url.searchParams.get("maxTs"),
			);
			res.writeHead(200, {
				"Content-Type": "text/event-stream; charset=utf-8",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
			});

			const { dbPath: activeDbPath, snapshot: initial } = readEnrichedSnapshot({
				requestedProjectOrDb,
				teamId,
				zoomLevel,
				maxTimestampMs,
			});
			const initialFp = readTraceFingerprint(activeDbPath, teamId).fingerprint;
			res.write(formatSseTraceEvent("TRACE_SNAPSHOT", initial));

			const client = {
				res,
				dbPath: activeDbPath,
				teamId,
				zoomLevel,
				maxTimestampMs,
				lastFingerprint: initialFp,
			};
			sseClients.add(client);
			req.on("close", () => {
				sseClients.delete(client);
			});
			return;
		}

		if (url.pathname === "/" || url.pathname === "/index.html") {
			const html = fs.existsSync(htmlPath)
				? fs.readFileSync(htmlPath, "utf8")
				: "<h1>agy-ensemble Mission Control</h1>";
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			res.end(html);
			return;
		}

		res.writeHead(404, { "Content-Type": "text/plain" });
		res.end("Not Found");
	};

	const server = http.createServer(handleRequest);

	const pollInterval = setInterval(() => {
		if (sseClients.size === 0) return;
		for (const client of sseClients) {
			try {
				const { fingerprint } = readTraceFingerprint(
					client.dbPath,
					client.teamId,
				);
				if (fingerprint !== client.lastFingerprint) {
					client.lastFingerprint = fingerprint;
					const { snapshot } = readEnrichedSnapshot({
						requestedProjectOrDb: client.dbPath,
						teamId: client.teamId,
						zoomLevel: client.zoomLevel,
						maxTimestampMs: client.maxTimestampMs,
					});
					client.res.write(formatSseTraceEvent("TRACE_SNAPSHOT", snapshot));
				} else {
					client.res.write(": keepalive\n\n");
				}
			} catch {
				sseClients.delete(client);
			}
		}
	}, 1000);
	pollInterval.unref();

	return new Promise((resolve, reject) => {
		server.once("error", (err) => {
			clearInterval(pollInterval);
			reject(err);
		});
		server.listen(port, host, () => {
			const address = server.address();
			const actualPort =
				address && typeof address === "object" ? address.port : port;
			resolve({
				server,
				port: actualPort,
				url: `http://${host}:${actualPort}`,
				close: () =>
					new Promise<void>((resClose) => {
						clearInterval(pollInterval);
						for (const client of sseClients) {
							try {
								client.res.end();
							} catch {
								// ignore
							}
						}
						sseClients.clear();
						server.close(() => resClose());
					}),
			});
		});
	});
}

/**
 * Start a resilient singleton Trace Graph HTTP/SSE server with standby failover:
 * if another agy-ensemble session already holds the port, stays on standby and
 * automatically claims the port if that previous holder exits.
 */
export async function startResilientTraceServer(options: {
	dbPath: string;
	port?: number;
	host?: string;
	htmlPath?: string;
	registryPath?: string;
	pollIntervalMs?: number;
}): Promise<ResilientTraceServerHandle> {
	const host = options.host ?? "127.0.0.1";
	const port = options.port ?? 4141;
	const registryPath = options.registryPath;

	if (options.dbPath !== ":memory:") {
		registerTraceProject({
			dbPath: options.dbPath,
			pid: process.pid,
			registryPath,
		});
	}

	let activeHandle: TraceGraphServerHandle | null = null;
	let closed = false;

	const tryAcquire = async (): Promise<void> => {
		if (closed || activeHandle) return;
		try {
			activeHandle = await startTraceGraphServer({
				dbPath: options.dbPath,
				port,
				host,
				htmlPath: options.htmlPath,
				registryPath,
			});
		} catch (err) {
			const code = (err as NodeJS.ErrnoException)?.code;
			if (code !== "EADDRINUSE") {
				throw err;
			}
		}
	};

	await tryAcquire();

	const standbyTimer = setInterval(async () => {
		if (closed || activeHandle) return;
		const healthy = await isTraceServerHealthy(port, host);
		if (!healthy) {
			await tryAcquire().catch(() => undefined);
		}
	}, options.pollIntervalMs ?? 5000);
	standbyTimer.unref();

	return {
		port,
		url: `http://${host}:${port}`,
		isOwner: () => activeHandle !== null,
		close: async () => {
			closed = true;
			clearInterval(standbyTimer);
			if (activeHandle) {
				await activeHandle.close();
				activeHandle = null;
			}
		},
	};
}
