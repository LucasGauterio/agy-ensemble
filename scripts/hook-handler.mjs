#!/usr/bin/env node
import fs from "node:fs";

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
		if (toolName === "run_command" && /(?:^|\s)--no-verify(?:\s|$)/.test(cmdLine)) {
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

	// PostToolUse or other lifecycle events expect {}
	if (payload.cwd && fs.existsSync(payload.cwd)) {
		// Telemetry placeholder: SQLite span recording runs via MCP tools or runner
	}
	process.stdout.write("{}\n");
}

main().catch(() => {
	process.stdout.write("{}\n");
});

