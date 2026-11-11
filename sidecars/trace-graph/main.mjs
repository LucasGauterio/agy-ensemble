import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_INDEX = path.join(__dirname, "web", "index.html");

function resolveProjectDbPath() {
	if (process.env.ENSEMBLE_DB_PATH) {
		const envPath = process.env.ENSEMBLE_DB_PATH;
		if (path.isAbsolute(envPath)) return envPath;
	}

	const relDb = process.env.ENSEMBLE_DB_PATH || path.join(".ensemble", "team.db");

	// When installed inside <project>/.agents/plugins/agy-ensemble/sidecars/trace-graph,
	// walking up 5 directories resolves directly to <project>.
	const installedProjectDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
	if (
		fs.existsSync(path.join(installedProjectDir, ".agents", "plugins", "agy-ensemble")) ||
		fs.existsSync(path.join(installedProjectDir, relDb))
	) {
		return path.join(installedProjectDir, relDb);
	}

	return path.resolve(process.cwd(), relDb);
}

async function loadSidecarSdk() {
	try {
		return await import("sidecar_sdk");
	} catch {
		const globalSdk = path.join(
			os.homedir(),
			".gemini",
			"config",
			"node_modules",
			"sidecar_sdk",
			"index.mjs",
		);
		if (fs.existsSync(globalSdk)) {
			return await import(pathToFileURL(globalSdk).href);
		}
		throw new Error("sidecar_sdk could not be resolved.");
	}
}

async function loadTraceHelpers() {
	const distIndex = path.resolve(__dirname, "..", "..", "dist", "index.js");
	if (fs.existsSync(distIndex)) {
		return await import(pathToFileURL(distIndex).href);
	}
	const srcServer = path.resolve(__dirname, "..", "..", "src", "trace-graph-server.ts");
	return await import(pathToFileURL(srcServer).href);
}

function parseZoom(raw) {
	if (raw === "1" || raw === 1) return 1;
	if (raw === "3" || raw === 3) return 3;
	return 2;
}

function parseMaxTs(raw) {
	if (raw === undefined || raw === null || raw === "") return undefined;
	const parsed = Number.parseInt(String(raw), 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

async function start() {
	const [{ SidecarApp, Response }, traceHelpers] = await Promise.all([
		loadSidecarSdk(),
		loadTraceHelpers(),
	]);

	const dbPath = resolveProjectDbPath();
	const app = new SidecarApp();

	app.page("/", () => {
		const html = fs.existsSync(WEB_INDEX)
			? fs.readFileSync(WEB_INDEX, "utf8")
			: "<h1>agy-ensemble Trace Graph</h1>";
		return new Response(html, { contentType: "text/html; charset=utf-8" });
	});

	app.api(
		"/api/trace/health",
		() => ({
			status: "ok",
			service: "trace-graph",
			dbExists: fs.existsSync(dbPath),
			dbPath,
		}),
		"GET",
	);

	app.api(
		"/api/trace/state",
		(data) => {
			const teamId = typeof data?.teamId === "string" && data.teamId ? data.teamId : undefined;
			const zoomLevel = parseZoom(data?.zoom);
			const maxTimestampMs = parseMaxTs(data?.maxTs);
			const reqProject =
				typeof data?.projectDir === "string" && data.projectDir
					? path.resolve(data.projectDir, ".ensemble", "team.db")
					: dbPath;
			const snap = traceHelpers.readTraceSnapshotFromFile(reqProject, {
				teamId,
				zoomLevel,
				maxTimestampMs,
			});
			const projects =
				typeof traceHelpers.listTraceProjects === "function"
					? traceHelpers.listTraceProjects()
					: [];
			return {
				...snap,
				activeDbPath: reqProject,
				activeProjectDir:
					typeof traceHelpers.resolveProjectDirFromDbPath === "function"
						? traceHelpers.resolveProjectDirFromDbPath(reqProject)
						: path.dirname(path.dirname(reqProject)),
				projects,
			};
		},
		"GET",
	);

	app.api(
		"/api/trace/node",
		(data) => {
			const spanId = typeof data?.spanId === "string" ? data.spanId : "";
			if (!spanId) {
				return new Response(JSON.stringify({ error: "Missing spanId parameter" }), {
					status: 400,
					contentType: "application/json",
				});
			}
			const reqProject =
				typeof data?.projectDir === "string" && data.projectDir
					? path.resolve(data.projectDir, ".ensemble", "team.db")
					: dbPath;
			try {
				return traceHelpers.readTraceNodeFromFile(reqProject, spanId);
			} catch (err) {
				return new Response(
					JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
					{ status: 404, contentType: "application/json" },
				);
			}
		},
		"GET",
	);

	await app.run();
}

start().catch((err) => {
	console.error("[agy-ensemble/trace-graph] Failed to start sidecar:", err);
	process.exit(1);
});
