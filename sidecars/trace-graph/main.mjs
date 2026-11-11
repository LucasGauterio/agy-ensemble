import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_INDEX = path.join(__dirname, "web", "index.html");

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

async function start() {
	const { SidecarApp, Response } = await loadSidecarSdk();
	const app = new SidecarApp();

	app.page("/", () => {
		const html = fs.existsSync(WEB_INDEX)
			? fs.readFileSync(WEB_INDEX, "utf8")
			: "<h1>agy-ensemble Trace Graph</h1>";
		return new Response(html, { contentType: "text/html; charset=utf-8" });
	});

	app.api(
		"/api/trace/health",
		() =>
			new Response(JSON.stringify({ status: "ok", service: "trace-graph" }), {
				contentType: "application/json",
			}),
		"GET",
	);

	app.listen();
}

start().catch((err) => {
	console.error("[agy-ensemble/trace-graph] Failed to start sidecar:", err);
	process.exit(1);
});

