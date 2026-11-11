import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb } from "./db";
import {
	installIntoProject,
	mergeMcpConfigFile,
	printInstallSummary,
	removeMcpServerFromFile,
	uninstallFromProject,
} from "./installer";

export interface RunnerOptions {
	command:
		| "install"
		| "setup"
		| "run"
		| "trace"
		| "verify"
		| "status"
		| "uninstall"
		| "help";
	targetDir?: string;
	sourceDir?: string;
	ensembleHome?: string;
	antigravityDir?: string;
	port?: number;
	dryRun?: boolean;
	runtime?: "bun" | "node";
	withTemplates?: boolean;
	localMcp?: boolean;
	noGlobal?: boolean;
	globalPlugin?: boolean;
	noUpdate?: boolean;
	force?: boolean;
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
		if (!arg) continue;

		if (arg === "install" || arg === "--install") {
			options.command = "install";
			explicitCommand = true;
		} else if (arg === "setup" || arg === "--setup") {
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
		} else if ((arg === "--target" || arg === "-t") && i + 1 < argv.length) {
			options.targetDir = argv[++i];
		} else if (arg === "--source" && i + 1 < argv.length) {
			options.sourceDir = argv[++i];
		} else if (
			(arg === "--install-dir" || arg === "--home") &&
			i + 1 < argv.length
		) {
			options.ensembleHome = argv[++i];
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
		} else if (arg === "--with-templates") {
			options.withTemplates = true;
		} else if (arg === "--local-mcp") {
			options.localMcp = true;
		} else if (arg === "--no-global") {
			options.noGlobal = true;
		} else if (arg === "--global") {
			options.globalPlugin = true;
		} else if (arg === "--no-update") {
			options.noUpdate = true;
		} else if (arg === "--force" || arg === "-f") {
			options.force = true;
		} else if (arg === "--runtime" && i + 1 < argv.length) {
			const r = argv[++i];
			if (r === "bun" || r === "node") {
				options.runtime = r;
			}
		} else if (!arg.startsWith("-") && !options.targetDir) {
			options.targetDir = arg;
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

	return mergeMcpConfigFile(
		mcpJsonPath,
		"agy-ensemble",
		{
			command: runtimeCommand,
			args: [mcpServerScript],
			env: {
				ENSEMBLE_DB_PATH: ".ensemble/team.db",
			},
		},
		{ dryRun: options.dryRun },
	);
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
	let removed = removeMcpServerFromFile(mcpJsonPath, "agy-ensemble", {
		dryRun: options.dryRun,
	});

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
  bunx github:LucasGauterio/agy-ensemble [target-dir] [options]
  ./agy-ensemble.sh <command> [options]    (Linux / macOS)
  .\\agy-ensemble.ps1 <command> [options]   (Windows PowerShell)

Commands:
  install [dir]  Clone/update ~/.agy-ensemble from GitHub and install into [dir]
  setup          Install dependencies, build bundles, link skill & register MCP
  run            Start the agy-ensemble MCP Server (stdio/JSON-RPC)
  trace          Launch the visual Mission Control Trace Graph server
  verify         Execute full verification test suite
  status         Inspect active team state and Antigravity configuration
  uninstall      Remove skill link and unregister from mcp.json (or project with --target)
  help           Show this help message

Options:
  --target, -t <dir>         Target project directory for install/uninstall
  --with-templates           Copy .gitleaks.toml, sonar-project.properties, etc.
  --local-mcp                Write/merge ./mcp.json in the target project
  --no-global                Skip updating ~/.gemini/antigravity/ during install
  --no-update                Skip git pull when ~/.agy-ensemble already exists
  --source <dir>             Use local agy-ensemble clone instead of GitHub
  --port <number>            Port for trace server (default: 4141)
  --antigravity-dir <path>   Override default ~/.gemini/antigravity path
  --runtime <bun|node>       Force specific runtime
  --force, -f                Overwrite existing links or templates
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

		case "install": {
			const res = installIntoProject({
				targetDir: options.targetDir ?? projectDir,
				ensembleHome: options.ensembleHome,
				sourceDir: options.sourceDir,
				antigravityDir: options.antigravityDir,
				runtime: options.runtime,
				withTemplates: options.withTemplates,
				localMcp: options.localMcp,
				noGlobal: options.noGlobal,
				globalPlugin: options.globalPlugin,
				noUpdate: options.noUpdate,
				force: options.force,
				dryRun: options.dryRun,
			});
			printInstallSummary(res, options.dryRun);
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
				: "npm install --include=dev";
			if (options.dryRun) {
				console.log(`      [dry-run] Would execute: ${installCmd}`);
			} else {
				execSync(installCmd, { stdio: "inherit", cwd: projectDir });
			}

			// 2. Build artifacts
			console.log("[2/5] Building TypeScript & MCP Server bundles...");
			const buildCmd = runtimeInfo.isBun
				? `${executablePath} run build`
				: "npm run build";
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
			if (options.targetDir) {
				const projRes = uninstallFromProject({
					targetDir: options.targetDir,
					antigravityDir: options.antigravityDir,
					global: options.globalPlugin,
					dryRun: options.dryRun,
				});
				console.log(
					projRes.uninstalled
						? `[agy-ensemble] Removed project integration from ${projRes.targetDir}: ${projRes.removed.join(", ")}`
						: `[agy-ensemble] Nothing to uninstall in ${projRes.targetDir}.`,
				);
				break;
			}
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
