#!/usr/bin/env node
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT_DIR = path.resolve(__dirname, "..");

function readStdin() {
	return new Promise((resolve) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => {
			resolve(data);
		});
		process.stdin.on("error", () => {
			resolve("");
		});
	});
}

const SENSITIVE_KEYS =
	/password|token|secret|authorization|apikey|api_key|cpf|cnpj|rg|email|telefone|celular|pix/i;

function sanitizePayload(value, depth = 0) {
	if (depth > 4) return "[TRUNCATED]";
	if (typeof value === "string") {
		const redacted = value
			.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[LGPD_REDACTED]")
			.replace(/(sk-live-[a-z0-9]+|ghp_[a-z0-9]+|AKIA[0-9A-Z]+)/gi, "[SECRET_REDACTED]");
		return redacted.length > 400 ? `${redacted.slice(0, 400)}...` : redacted;
	}
	if (Array.isArray(value)) {
		return value.slice(0, 20).map((item) => sanitizePayload(item, depth + 1));
	}
	if (value && typeof value === "object") {
		const out = {};
		for (const [k, v] of Object.entries(value)) {
			out[k] = SENSITIVE_KEYS.test(k)
				? "[LGPD_REDACTED]"
				: sanitizePayload(v, depth + 1);
		}
		return out;
	}
	return value;
}

function getRegistryPath() {
	if (process.env.AGY_ENSEMBLE_TRACE_REGISTRY) {
		return path.resolve(process.env.AGY_ENSEMBLE_TRACE_REGISTRY);
	}
	return path.join(os.homedir(), ".agy-ensemble", "trace-registry.json");
}

function registerProject(projectDir, dbPath) {
	try {
		const registryPath = getRegistryPath();
		const resolvedDb = path.resolve(dbPath);
		const resolvedProj = path.resolve(projectDir);
		let existing = [];
		if (fs.existsSync(registryPath)) {
			try {
				const parsed = JSON.parse(fs.readFileSync(registryPath, "utf8"));
				if (Array.isArray(parsed)) existing = parsed;
			} catch {
				existing = [];
			}
		}
		const filtered = existing.filter(
			(e) => e && typeof e.dbPath === "string" && path.resolve(e.dbPath) !== resolvedDb,
		);
		const updated = [
			{
				projectDir: resolvedProj,
				projectName: path.basename(resolvedProj) || resolvedProj,
				dbPath: resolvedDb,
				dbExists: fs.existsSync(resolvedDb),
				updatedAt: Date.now(),
			},
			...filtered,
		].slice(0, 20);
		fs.mkdirSync(path.dirname(registryPath), { recursive: true });
		fs.writeFileSync(registryPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
	} catch {
		// Ignore registry errors
	}
}

function probeTraceServer(port) {
	return new Promise((resolve) => {
		const req = http.get(
			{ host: "127.0.0.1", port, path: "/api/trace/health", timeout: 250 },
			(res) => {
				res.resume();
				resolve(res.statusCode === 200);
			},
		);
		req.on("timeout", () => {
			req.destroy();
			resolve(false);
		});
		req.on("error", () => resolve(false));
	});
}

async function ensureTraceDaemonForWorkspace(payload) {
	if (process.env.AGY_ENSEMBLE_DISABLE_TRACE_SERVER === "1") return;

	const cwd =
		typeof payload.cwd === "string" && payload.cwd
			? payload.cwd
			: Array.isArray(payload.workspacePaths) && payload.workspacePaths[0]
				? String(payload.workspacePaths[0])
				: "";
	if (!cwd || !fs.existsSync(cwd)) return;

	const pluginActive = fs.existsSync(
		path.join(cwd, ".agents", "plugins", "agy-ensemble"),
	);
	const dbPath =
		process.env.ENSEMBLE_DB_PATH && path.isAbsolute(process.env.ENSEMBLE_DB_PATH)
			? process.env.ENSEMBLE_DB_PATH
			: path.join(cwd, process.env.ENSEMBLE_DB_PATH || ".ensemble/team.db");
	const dbExists = fs.existsSync(dbPath);

	if (!pluginActive && !dbExists) return;

	registerProject(cwd, dbPath);

	const rawPort = Number.parseInt(
		process.env.AGY_ENSEMBLE_TRACE_PORT || "4141",
		10,
	);
	const port = Number.isNaN(rawPort) ? 4141 : rawPort;
	if (await probeTraceServer(port)) return;

	const binCandidates = [
		path.join(cwd, ".agents", "plugins", "agy-ensemble", "bin", "agy-ensemble.mjs"),
		path.join(PLUGIN_ROOT_DIR, "bin", "agy-ensemble.mjs"),
		path.join(os.homedir(), ".agy-ensemble", "bin", "agy-ensemble.mjs"),
	];
	const binEntry = binCandidates.find((p) => fs.existsSync(p));
	if (!binEntry) return;

	try {
		const child = spawn(
			process.execPath,
			[binEntry, "trace", "--daemon", "--watch-ls", "--target", cwd, "--port", String(port)],
			{
				cwd,
				detached: true,
				stdio: "ignore",
				windowsHide: true,
				env: process.env,
			},
		);
		child.unref();
	} catch {
		// Ignore background spawn failure
	}
}

async function recordHookTelemetry(payload) {
	const cwd = typeof payload.cwd === "string" ? payload.cwd : "";
	if (!cwd) return;

	const dbPath =
		process.env.ENSEMBLE_DB_PATH && path.isAbsolute(process.env.ENSEMBLE_DB_PATH)
			? process.env.ENSEMBLE_DB_PATH
			: path.join(cwd, process.env.ENSEMBLE_DB_PATH || ".ensemble/team.db");

	if (!fs.existsSync(dbPath)) return;

	const toolName = String(payload.toolCall?.name ?? "");
	if (!toolName || toolName.startsWith("ensemble_")) {
		// MCP tools already record rich spans directly in src/mcp-server.ts
		return;
	}

	const sqlite = await import("node:sqlite");
	const db = new sqlite.DatabaseSync(dbPath);
	try {
		db.exec("PRAGMA busy_timeout=2000");
		const teamRow = db
			.prepare(
				"SELECT id, name FROM team WHERE status = 'active' ORDER BY time_updated DESC LIMIT 1",
			)
			.get();
		if (!teamRow?.id) return;

		let rootSpan = db
			.prepare(
				"SELECT id FROM trace_nodes WHERE team_id = ? AND zoom_level = 1 ORDER BY time_started ASC LIMIT 1",
			)
			.get(teamRow.id);

		const now = Date.now();
		if (!rootSpan?.id) {
			const rootId = `span_${crypto.randomUUID()}`;
			db.prepare(
				`INSERT INTO trace_nodes (
          id, team_id, parent_id, zoom_level, node_kind, label, status,
          est_cost_usd, est_duration_ms, payload_json, time_started
        ) VALUES (?, ?, NULL, 1, 'PIPELINE_STAGE', ?, 'running', 0, 0, ?, ?)`,
			).run(
				rootId,
				teamRow.id,
				`Team: ${teamRow.name}`,
				JSON.stringify({ teamId: teamRow.id }),
				now,
			);
			rootSpan = { id: rootId };
		}

		const spanId = `span_${crypto.randomUUID()}`;
		const args = payload.toolCall?.args ?? {};
		const cmdHint =
			typeof args.CommandLine === "string"
				? ` (${sanitizePayload(args.CommandLine)})`
				: typeof args.Path === "string"
					? ` (${path.basename(args.Path)})`
					: typeof args.TargetFile === "string"
						? ` (${path.basename(args.TargetFile)})`
						: "";
		const label = `${toolName}${cmdHint}`.slice(0, 120);
		const status = payload.error ? "failed" : "completed";

		db.prepare(
			`INSERT INTO trace_nodes (
        id, team_id, parent_id, zoom_level, node_kind, label, status,
        est_cost_usd, actual_cost_usd, est_duration_ms, actual_duration_ms,
        input_tokens, output_tokens, payload_json, time_started, time_completed
      ) VALUES (?, ?, ?, 3, 'TOOL_CALL', ?, ?, 0, 0, 0, 1, 0, 0, ?, ?, ?)`,
		).run(
			spanId,
			teamRow.id,
			rootSpan.id,
			label,
			status,
			JSON.stringify(
				sanitizePayload({
					tool: toolName,
					args,
					...(payload.error ? { error: payload.error } : {}),
				}),
			),
			now,
			now,
		);

		db.prepare(
			`INSERT INTO trace_edges (id, team_id, source_id, target_id, edge_kind, label, time_created)
       VALUES (?, ?, ?, ?, 'HIERARCHY', 'parent-child', ?)`,
		).run(
			`edge_${crypto.randomUUID()}`,
			teamRow.id,
			rootSpan.id,
			spanId,
			now,
		);
	} finally {
		db.close();
	}
}

async function main() {
	const raw = await readStdin();
	let payload = {};
	try {
		payload = raw.trim() ? JSON.parse(raw) : {};
	} catch {
		payload = {};
	}

	const eventName = payload.hookEventName;
	if (eventName === "PreToolUse") {
		const toolName = payload.toolCall?.name;
		const cmdLine = String(payload.toolCall?.args?.CommandLine ?? "");
		if (
			toolName === "run_command" &&
			/(?:^|\s)--no-verify(?:\s|$)/.test(cmdLine)
		) {
			process.stdout.write(
				`${JSON.stringify({
					decision: "deny",
					reason:
						"[agy-ensemble] Mandato NFR-0: --no-verify is forbidden (Gitleaks pre-commit protection).",
				})}\n`,
			);
			return;
		}
		process.stdout.write(`${JSON.stringify({ decision: "ask" })}\n`);
		return;
	}

	try {
		await ensureTraceDaemonForWorkspace(payload);
		if (eventName === "PostToolUse") {
			await recordHookTelemetry(payload);
		}
	} catch {
		// Telemetry must never break hook execution
	}
	process.stdout.write("{}\n");
}

main().catch(() => {
	process.stdout.write("{}\n");
});
