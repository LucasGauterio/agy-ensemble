import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb } from "../src/db";
import { ensembleCreate } from "../src/mcp-server";
import {
	recordActionSpanComplete,
	recordActionSpanStart,
} from "../src/trace-collector";
import {
	buildSemanticZoomGraphPayload,
	buildTraceSnapshot,
	formatSseTraceEvent,
	getInspectorDrawerData,
	readTraceSnapshotFromFile,
	startTraceGraphServer,
} from "../src/trace-graph-server";

describe("IMP-04 / VAL-04: Live Execution Trace Graph UI & 3-Level Semantic Zoom", () => {
	test("builds Level 1 (Macro), Level 2 (Meso SI DAG), and Level 3 (Micro Spans) graph payloads, Inspector 4-tab data, and Time-Travel scrub filter", () => {
		const db = createDb(":memory:");
		const team = ensembleCreate(db, {
			name: "trace-ui-team",
			leadSessionId: "lead-ui",
		});

		const l1 = recordActionSpanStart(db, {
			teamId: team.id,
			zoomLevel: 1,
			nodeKind: "PIPELINE_STAGE",
			label: "Etapa 8: Multi-Agent DAG Execution",
			estCostUsd: 0.5,
			estDurationMs: 120000,
		});
		const l2 = recordActionSpanStart(db, {
			teamId: team.id,
			parentId: l1.id,
			zoomLevel: 2,
			nodeKind: "SI_NODE",
			label: "SI-01.1: Auth & LGPD Consent",
			siId: "SI-01.1",
			agentName: "worker-si-01-1",
			estCostUsd: 0.25,
			estDurationMs: 60000,
		});
		const l3 = recordActionSpanStart(db, {
			teamId: team.id,
			parentId: l2.id,
			zoomLevel: 3,
			nodeKind: "TOOL_CALL",
			label: "run-suite.sh SI-01.1",
			siId: "SI-01.1",
			agentName: "worker-si-01-1",
			estCostUsd: 0.05,
			estDurationMs: 15000,
		});
		recordActionSpanComplete(db, {
			spanId: l3.id,
			status: "completed",
			inputTokens: 4000,
			outputTokens: 1000,
			actualCostUsd: 0.04,
			actualDurationMs: 12000,
		});

		const macro = buildSemanticZoomGraphPayload(db, {
			teamId: team.id,
			zoomLevel: 1,
		});
		const meso = buildSemanticZoomGraphPayload(db, {
			teamId: team.id,
			zoomLevel: 2,
		});
		const micro = buildSemanticZoomGraphPayload(db, {
			teamId: team.id,
			zoomLevel: 3,
		});

		expect(macro.nodes.length).toBe(1);
		expect(meso.nodes.length).toBe(1);
		expect(micro.nodes.length).toBe(1);

		const inspector = getInspectorDrawerData(db, l3.id);
		expect(inspector.tabs).toEqual([
			"Prompt & Context",
			"Diff & Files",
			"Tests & Quality Gate",
			"Logs & Telemetry",
		]);
		expect(inspector.finops.estCostUsd).toBe(0.05);
		expect(inspector.finops.actualCostUsd).toBe(0.04);

		const sse = formatSseTraceEvent("SPAN_END", {
			spanId: l3.id,
			status: "completed",
		});
		expect(sse).toContain("event: SPAN_END");
		expect(sse).toContain(`"spanId":"${l3.id}"`);

		const snapshot = buildTraceSnapshot(db, { teamId: team.id, zoomLevel: 2 });
		expect(snapshot.hasData).toBe(true);
		expect(snapshot.levelCounts).toEqual({ level1: 1, level2: 1, level3: 1 });
		expect(snapshot.nodes[0]?.siId).toBe("SI-01.1");
	});

	test("serves live Trace Graph HTTP/SSE endpoints without prematurely creating missing DB and records hook telemetry safely", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-trace-http-"));
		const dbPath = path.join(tmpDir, ".ensemble", "team.db");
		const hookScript = path.resolve(
			import.meta.dir,
			"..",
			"scripts",
			"hook-handler.mjs",
		);

		try {
			// 1. Missing DB must return empty snapshot without creating .ensemble/team.db
			const missingSnap = readTraceSnapshotFromFile(dbPath);
			expect(missingSnap.dbExists).toBe(false);
			expect(missingSnap.hasData).toBe(false);
			expect(fs.existsSync(dbPath)).toBe(false);

			// 2. Hook handler on a project without .ensemble/team.db must exit {} without creating DB
			const hookNoDbOut = execFileSync("node", [hookScript], {
				input: JSON.stringify({
					hookEventName: "PostToolUse",
					cwd: tmpDir,
					toolCall: { name: "run_command", args: { CommandLine: "echo ok" } },
				}),
				encoding: "utf8",
			});
			expect(hookNoDbOut.trim()).toBe("{}");
			expect(fs.existsSync(dbPath)).toBe(false);

			// 3. Seed team + spans and start live server on ephemeral port 0
			const db = createDb(dbPath);
			const team = ensembleCreate(db, {
				name: "live-trace-team",
				leadSessionId: "lead-live",
			});
			const l2 = recordActionSpanStart(db, {
				teamId: team.id,
				zoomLevel: 2,
				nodeKind: "SI_NODE",
				label: "SI-01.1: Live Endpoint",
				siId: "SI-01.1",
				estCostUsd: 0.12,
				estDurationMs: 15000,
			});
			db.close();

			// 4. Hook handler with active team records a Level 3 TOOL_CALL span with PII redacted
			const hookOut = execFileSync("node", [hookScript], {
				input: JSON.stringify({
					hookEventName: "PostToolUse",
					cwd: tmpDir,
					toolCall: {
						name: "run_command",
						args: { CommandLine: "echo 123.456.789-00", token: "secret-abc" },
					},
				}),
				encoding: "utf8",
			});
			expect(hookOut.trim()).toBe("{}");

			const server = await startTraceGraphServer({ dbPath, port: 0 });
			try {
				const healthRes = await fetch(`${server.url}/api/trace/health`);
				expect(healthRes.status).toBe(200);
				const healthJson = (await healthRes.json()) as {
					status: string;
					dbExists: boolean;
				};
				expect(healthJson.status).toBe("ok");
				expect(healthJson.dbExists).toBe(true);

				const stateRes = await fetch(`${server.url}/api/trace/state?zoom=3`);
				expect(stateRes.status).toBe(200);
				const stateJson = (await stateRes.json()) as {
					hasData: boolean;
					nodes: Array<{ id: string; label: string }>;
				};
				expect(stateJson.hasData).toBe(true);
				expect(stateJson.nodes.some((n) => n.label.includes("[LGPD_REDACTED]"))).toBe(
					true,
				);

				const nodeRes = await fetch(
					`${server.url}/api/trace/node?spanId=${encodeURIComponent(l2.id)}`,
				);
				expect(nodeRes.status).toBe(200);
				const nodeJson = (await nodeRes.json()) as {
					spanId: string;
					tabs: string[];
				};
				expect(nodeJson.spanId).toBe(l2.id);
				expect(nodeJson.tabs).toHaveLength(4);

				const htmlRes = await fetch(`${server.url}/`);
				expect(htmlRes.status).toBe(200);
				const html = await htmlRes.text();
				expect(html).toContain("agy-ensemble Mission Control");
				expect(html).toContain("/api/trace/state");

				// Verify SSE stream delivers initial TRACE_SNAPSHOT event
				const sseController = new AbortController();
				const sseRes = await fetch(`${server.url}/api/trace/stream?zoom=2`, {
					signal: sseController.signal,
				});
				expect(sseRes.status).toBe(200);
				const reader = sseRes.body?.getReader();
				expect(reader).toBeDefined();
				if (reader) {
					const chunk = await reader.read();
					const text = new TextDecoder().decode(chunk.value);
					expect(text).toContain("event: TRACE_SNAPSHOT");
					expect(text).toContain("SI-01.1: Live Endpoint");
					sseController.abort();
				}
			} finally {
				await server.close();
			}
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});
});
