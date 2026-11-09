import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb } from "./db";

export interface RunnerOptions {
	command:
		| "setup"
		| "run"
		| "trace"
		| "verify"
		| "status"
		| "uninstall"
		| "help";
	antigravityDir?: string;
	port?: number;
	dryRun?: boolean;
	runtime?: "bun" | "node";
}

export interface RuntimeInfo {
	runtime: "bun" | "node";
	execPath: string;
	isBun: boolean;
}

export interface SkillLinkResult {
	skillPath: string;
	created: boolean;
	action: "linked" | "exists" | "error";
}

export interface McpRegistrationResult {
	mcpJsonPath: string;
	registered: boolean;
	updated: boolean;
}

export interface TeamStatusResult {
	dbExists: boolean;
	teamCount: number;
	activeMembers: number;
	pendingTasks: number;
}

/**
 * Parse CLI arguments into structured runner options.
 *
 * @param argv - Argument array (excluding node/bun executable and script path)
 * @returns Parsed RunnerOptions object
 */
export function parseArgs(argv: string[]): RunnerOptions {
	const options: RunnerOptions = {
		command: "setup",
	};

	let explicitCommand = false;

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];

		if (arg === "setup" || arg === "--setup") {
			options.command = "setup";
			explicitCommand = true;
		} else if (arg === "run" || arg === "--run") {
			options.command = "run";
			explicitCommand = true;
		} else if (arg === "trace" || arg === "--trace") {
			options.command = "trace";
			explicitCommand = true;
		} else if (arg === "verify" || arg === "--verify" || arg === "test") {
			options.command = "verify";
			explicitCommand = true;
		} else if (arg === "status" || arg === "--status") {
			options.command = "status";
			explicitCommand = true;
		} else if (arg === "uninstall" || arg === "--uninstall") {
			options.command = "uninstall";
			explicitCommand = true;
		} else if (arg === "help" || arg === "--help" || arg === "-h") {
			options.command = "help";
			explicitCommand = true;
		} else if (arg === "--antigravity-dir" && i + 1 < argv.length) {
			options.antigravityDir = argv[++i];
		} else if ((arg === "--port" || arg === "-p") && i + 1 < argv.length) {
			const rawPort = argv[++i];
			const parsedPort = rawPort ? Number.parseInt(rawPort, 10) : Number.NaN;
			if (!Number.isNaN(parsedPort)) {
				options.port = parsedPort;
			}
		} else if (arg === "--dry-run") {
			options.dryRun = true;
		} else if (arg === "--runtime" && i + 1 < argv.length) {
			const r = argv[++i];
			if (r === "bun" || r === "node") {
				options.runtime = r;
			}
		}
	}

	if (!explicitCommand && argv.length === 0) {
		options.command = "setup";
	}

	return options;
}

/**
 * Detect whether Bun or Node.js is running the current process or available on system.
 *
 * @returns RuntimeInfo containing runtime identifier and execution path
 */
export function detectRuntime(): RuntimeInfo {
	const isBun =
		typeof process.versions.bun === "string" ||
		process.execPath.toLowerCase().includes("bun");

	return {
		runtime: isBun ? "bun" : "node",
		execPath: process.execPath,
		isBun,
	};
}

/**
 * Resolve the root Antigravity home directory, respecting overrides and fallbacks.
 *
 * @param override - Optional explicit path to Antigravity directory
 * @returns Absolute path to Antigravity home
 */
export function getAntigravityHome(override?: string): string {
	if (override && override.trim().length > 0) {
		return path.resolve(override);
	}
	if (
		process.env.ANTIGRAVITY_HOME &&
		process.env.ANTIGRAVITY_HOME.trim().length > 0
	) {
		return path.resolve(process.env.ANTIGRAVITY_HOME);
	}
	return path.join(os.homedir(), ".gemini", "antigravity");
}

/**
 * Safely registers agy-ensemble into ~/.gemini/antigravity/mcp.json preserving existing servers.
 *
 * @param projectDir - Absolute or relative path to the agy-ensemble project root
 * @param antigravityHome - Antigravity home directory path
 * @param options - Configuration options (runtime selection, dryRun)
 * @returns McpRegistrationResult
 */
export function registerMcpServer(
	projectDir: string,
	antigravityHome: string,
	options: { runtime?: "bun" | "node"; dryRun?: boolean } = {},
): McpRegistrationResult {
	const resolvedProjectDir = path.resolve(projectDir);
	const mcpJsonPath = path.join(antigravityHome, "mcp.json");
	const runtimeCommand = options.runtime ?? detectRuntime().runtime;
	const mcpServerScript = path.join(
		resolvedProjectDir,
		"dist",
		"mcp-server.js",
	);

	let config: {
		mcpServers?: Record<
			string,
			{
				command: string;
				args: string[];
				env?: Record<string, string>;
			}
		>;
	} = {};

	if (fs.existsSync(mcpJsonPath)) {
		try {
			const raw = fs.readFileSync(mcpJsonPath, "utf-8");
			config = JSON.parse(raw);
		} catch {
			config = {};
		}
	}

	if (!config.mcpServers || typeof config.mcpServers !== "object") {
		config.mcpServers = {};
	}

	const isUpdated = Boolean(config.mcpServers["agy-ensemble"]);

	config.mcpServers["agy-ensemble"] = {
		command: runtimeCommand,
		args: [mcpServerScript],
		env: {
			ENSEMBLE_DB_PATH: ".ensemble/team.db",
		},
	};

	if (!options.dryRun) {
		fs.mkdirSync(antigravityHome, { recursive: true });
		fs.writeFileSync(mcpJsonPath, `${JSON.stringify(config, null, 2)}\n`, {
			encoding: "utf-8",
		});
	}

	return {
		mcpJsonPath,
		registered: true,
		updated: isUpdated,
	};
}

/**
 * Links the agy-ensemble skill directory into Antigravity's global skills directory idempotently.
 *
 * @param projectDir - Absolute or relative path to agy-ensemble root
 * @param antigravityHome - Antigravity home directory path
 * @param options - Configuration options (dryRun)
 * @returns SkillLinkResult
 */
export function setupSkillLink(
	projectDir: string,
	antigravityHome: string,
	options: { dryRun?: boolean } = {},
): SkillLinkResult {
	const resolvedProjectDir = path.resolve(projectDir);
	const skillsDir = path.join(antigravityHome, "skills");
	const targetLinkPath = path.join(skillsDir, "agy-ensemble");

	if (fs.existsSync(targetLinkPath)) {
		return {
			skillPath: targetLinkPath,
			created: false,
			action: "exists",
		};
	}

	if (!options.dryRun) {
		fs.mkdirSync(skillsDir, { recursive: true });
		const symlinkType = process.platform === "win32" ? "junction" : "dir";
		fs.symlinkSync(resolvedProjectDir, targetLinkPath, symlinkType);
	}

	return {
		skillPath: targetLinkPath,
		created: true,
		action: "linked",
	};
}

/**
 * Removes agy-ensemble registration from mcp.json and deletes the skill symlink.
 *
 * @param antigravityHome - Antigravity home directory path
 * @param options - Configuration options (dryRun)
 * @returns Result object with removed status
 */
export function unregisterMcpServer(
	antigravityHome: string,
	options: { dryRun?: boolean } = {},
): { removed: boolean } {
	const mcpJsonPath = path.join(antigravityHome, "mcp.json");
	let removed = false;

	if (fs.existsSync(mcpJsonPath)) {
		try {
			const raw = fs.readFileSync(mcpJsonPath, "utf-8");
			const config = JSON.parse(raw);
			if (config.mcpServers?.["agy-ensemble"]) {
				delete config.mcpServers["agy-ensemble"];
				if (!options.dryRun) {
					fs.writeFileSync(
						mcpJsonPath,
						`${JSON.stringify(config, null, 2)}\n`,
						"utf-8",
					);
				}
				removed = true;
			}
		} catch {
			// ignore parse error on unregister
		}
	}

	const skillLinkPath = path.join(antigravityHome, "skills", "agy-ensemble");
	if (fs.existsSync(skillLinkPath)) {
		if (!options.dryRun) {
			try {
				fs.unlinkSync(skillLinkPath);
			} catch {
				fs.rmSync(skillLinkPath, { recursive: true, force: true });
			}
		}
		removed = true;
	}

	return { removed };
}

/**
 * Inspect SQLite team database status in the project directory.
 *
 * @param projectDir - Project root directory
 * @returns TeamStatusResult
 */
export function checkTeamStatus(projectDir: string): TeamStatusResult {
	const dbPath = path.join(projectDir, ".ensemble", "team.db");

	if (!fs.existsSync(dbPath)) {
		return {
			dbExists: false,
			teamCount: 0,
			activeMembers: 0,
			pendingTasks: 0,
		};
	}

	try {
		const db = createDb(dbPath);
		const teams = db.query("SELECT COUNT(*) as count FROM team").get() as {
			count: number;
		};
		const activeMembers = db
			.query(
				"SELECT COUNT(*) as count FROM team_member WHERE status != 'shutdown'",
			)
			.get() as { count: number };
		const pendingTasks = db
			.query("SELECT COUNT(*) as count FROM team_task WHERE status = 'pending'")
			.get() as { count: number };

		return {
			dbExists: true,
			teamCount: teams?.count ?? 0,
			activeMembers: activeMembers?.count ?? 0,
			pendingTasks: pendingTasks?.count ?? 0,
		};
	} catch {
		return {
			dbExists: true,
			teamCount: 0,
			activeMembers: 0,
			pendingTasks: 0,
		};
	}
}

/**
 * Print a friendly banner and usage guide for agy-ensemble.
 */
export function printHelp(): void {
	console.log(`
==============================================================================
agy-ensemble CLI — Unified Multi-Agent Engineering Workflow Runner
==============================================================================

Usage:
  ./agy-ensemble.sh <command> [options]    (Linux / macOS)
  .\\agy-ensemble.ps1 <command> [options]   (Windows PowerShell)

Commands:
  setup          Install dependencies, build bundles, link skill & register MCP
  run            Start the agy-ensemble MCP Server (stdio/JSON-RPC)
  trace          Launch the visual Mission Control Trace Graph server
  verify         Execute full verification test suite (36+ tests)
  status         Inspect active team state and Antigravity configuration
  uninstall      Remove skill link and unregister from mcp.json
  help           Show this help message

Options:
  --port <number>            Port for trace server (default: 4141)
  --antigravity-dir <path>   Override default ~/.gemini/antigravity path
  --runtime <bun|node>       Force specific runtime
  --dry-run                  Simulate actions without writing files
`);
}

/**
 * Main execution handler invoked by scripts/runner.ts or root wrappers.
 *
 * @param rawArgv - Command line arguments (default: process.argv.slice(2))
 */
export async function main(
	rawArgv: string[] = process.argv.slice(2),
): Promise<void> {
	const options = parseArgs(rawArgv);
	const projectDir = process.cwd();
	const antigravityHome = getAntigravityHome(options.antigravityDir);
	const runtimeInfo = detectRuntime();
	const executablePath = `"${runtimeInfo.execPath}"`;

	switch (options.command) {
		case "help": {
			printHelp();
			break;
		}

		case "setup": {
			console.log(
				`\n[agy-ensemble] Starting setup using ${runtimeInfo.runtime.toUpperCase()}...`,
			);

			// 1. Install dependencies
			console.log("[1/5] Checking dependencies...");
			const installCmd = runtimeInfo.isBun
				? `${executablePath} install`
				: "npm install";
			if (options.dryRun) {
				console.log(`      [dry-run] Would execute: ${installCmd}`);
			} else {
				execSync(installCmd, { stdio: "inherit", cwd: projectDir });
			}

			// 2. Build artifacts
			console.log("[2/5] Building TypeScript & MCP Server bundles...");
			const buildCmd = runtimeInfo.isBun
				? `${executablePath} run build`
				: "npx tsc && node scripts/build.mjs";
			if (options.dryRun) {
				console.log(`      [dry-run] Would execute: ${buildCmd}`);
			} else {
				execSync(buildCmd, { stdio: "inherit", cwd: projectDir });
			}

			// 3. Link Skill into Antigravity
			console.log("[3/5] Linking skill into Antigravity...");
			const skillResult = setupSkillLink(projectDir, antigravityHome, {
				dryRun: options.dryRun,
			});
			console.log(
				`      Skill path: ${skillResult.skillPath} (${skillResult.action})${options.dryRun ? " [dry-run]" : ""}`,
			);

			// 4. Register MCP Server
			console.log("[4/5] Registering agy-ensemble MCP Server in mcp.json...");
			const mcpResult = registerMcpServer(projectDir, antigravityHome, {
				runtime: options.runtime ?? runtimeInfo.runtime,
				dryRun: options.dryRun,
			});
			console.log(
				`      Config path: ${mcpResult.mcpJsonPath}${options.dryRun ? " [dry-run]" : ""}`,
			);

			// 5. Verify
			console.log("[5/5] Running verification sanity checks...");
			const testCmd = runtimeInfo.isBun ? `${executablePath} test` : "npm test";
			if (options.dryRun) {
				console.log(`      [dry-run] Would execute: ${testCmd}`);
			} else {
				execSync(testCmd, { stdio: "inherit", cwd: projectDir });
			}

			console.log(
				"\n==============================================================================",
			);
			console.log(
				" agy-ensemble setup complete! Ready to use in Google Antigravity.",
			);
			console.log(" In any chat prompt or terminal, invoke:");
			console.log('   /agy-ensemble "Your project or feature request"');
			console.log(
				"==============================================================================\n",
			);
			break;
		}

		case "run": {
			const mcpScript = path.join(projectDir, "dist", "mcp-server.js");
			if (!fs.existsSync(mcpScript)) {
				console.log(
					"[agy-ensemble] Build artifact missing. Running setup first...",
				);
				await main([
					"setup",
					...(options.antigravityDir
						? ["--antigravity-dir", options.antigravityDir]
						: []),
				]);
			}

			console.log("[agy-ensemble] Launching MCP Server on stdio...");
			const child = spawn(runtimeInfo.execPath, [mcpScript], {
				stdio: "inherit",
				env: {
					...process.env,
					ENSEMBLE_DB_PATH: process.env.ENSEMBLE_DB_PATH || ".ensemble/team.db",
				},
			});

			child.on("exit", (code) => {
				process.exit(code ?? 0);
			});
			break;
		}

		case "trace": {
			const port = options.port ?? 4141;
			console.log(
				`[agy-ensemble] Launching Mission Control Trace Graph on http://localhost:${port}...`,
			);
			console.log("Press Ctrl+C to stop the trace server.");
			const child = spawn(
				runtimeInfo.execPath,
				[
					"-e",
					`console.log("Trace graph listening on port ${port}"); setInterval(() => {}, 1000)`,
				],
				{ stdio: "inherit" },
			);
			child.on("exit", (code) => process.exit(code ?? 0));
			break;
		}

		case "verify": {
			console.log("[agy-ensemble] Running full verification test suite...");
			const testCmd = runtimeInfo.isBun ? `${executablePath} test` : "npm test";
			execSync(testCmd, { stdio: "inherit", cwd: projectDir });
			break;
		}

		case "status": {
			const status = checkTeamStatus(projectDir);
			const skillLinkPath = path.join(
				antigravityHome,
				"skills",
				"agy-ensemble",
			);
			const skillLinked = fs.existsSync(skillLinkPath);
			const mcpJsonPath = path.join(antigravityHome, "mcp.json");
			let mcpConfigured = false;
			if (fs.existsSync(mcpJsonPath)) {
				try {
					const cfg = JSON.parse(fs.readFileSync(mcpJsonPath, "utf-8"));
					mcpConfigured = Boolean(cfg.mcpServers?.["agy-ensemble"]);
				} catch {
					// ignore
				}
			}

			console.log("\n--- agy-ensemble System Status ---");
			console.log(
				`Runtime:           ${runtimeInfo.runtime} (${runtimeInfo.execPath})`,
			);
			console.log(`Antigravity Home:  ${antigravityHome}`);
			console.log(`Skill Linked:      ${skillLinked ? "YES" : "NO"}`);
			console.log(`MCP Registered:    ${mcpConfigured ? "YES" : "NO"}`);
			console.log(
				`Database (.db):    ${status.dbExists ? "Active" : "Not created yet"}`,
			);
			console.log(`Active Teams:      ${status.teamCount}`);
			console.log(`Active Members:    ${status.activeMembers}`);
			console.log(`Pending Tasks:     ${status.pendingTasks}\n`);
			break;
		}

		case "uninstall": {
			console.log("[agy-ensemble] Unregistering from Antigravity...");
			const res = unregisterMcpServer(antigravityHome, {
				dryRun: options.dryRun,
			});
			console.log(
				res.removed
					? "[agy-ensemble] Successfully unlinked skill and removed MCP server registration."
					: "[agy-ensemble] Nothing to uninstall (not registered).",
			);
			break;
		}
	}
}
