import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Default upstream Git repository URL for agy-ensemble. */
export const DEFAULT_GITHUB_REPO_URL =
	"https://github.com/LucasGauterio/agy-ensemble.git";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT_DIR = path.resolve(__dirname, "..");

/**
 * Resolve the global agy-ensemble installation directory (~/.agy-ensemble by default).
 *
 * @param {string} [override]
 * @returns {string}
 */
export function getDefaultEnsembleHome(override) {
	if (override && override.trim().length > 0) {
		return path.resolve(override);
	}
	if (
		process.env.AGY_ENSEMBLE_HOME &&
		process.env.AGY_ENSEMBLE_HOME.trim().length > 0
	) {
		return path.resolve(process.env.AGY_ENSEMBLE_HOME);
	}
	return path.join(os.homedir(), ".agy-ensemble");
}

/**
 * Resolve the root Antigravity home directory (~/.gemini/antigravity by default).
 *
 * @param {string} [override]
 * @returns {string}
 */
export function getAntigravityHome(override) {
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

/** @type {Map<string, string | null>} */
const executableCache = new Map();

/**
 * Check whether an executable exists on PATH (or via bun binary locations).
 *
 * @param {string} cmd
 * @returns {string | null}
 */
export function findExecutable(cmd) {
	if (executableCache.has(cmd)) {
		return executableCache.get(cmd) ?? null;
	}
	const checkCmd = process.platform === "win32" ? "where" : "which";
	const res = spawnSync(checkCmd, [cmd], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	if (res.status === 0 && res.stdout) {
		const firstLine = res.stdout.split(/\r?\n/).find((l) => l.trim().length > 0);
		if (firstLine) {
			const trimmed = firstLine.trim();
			executableCache.set(cmd, trimmed);
			return trimmed;
		}
	}
	executableCache.set(cmd, null);
	return null;
}

/**
 * Check whether an executable path is inside a temporary/local node_modules/.bin directory.
 *
 * @param {string} exePath
 * @returns {boolean}
 */
function isNodeModulesBinPath(exePath) {
	const normalized = exePath.toLowerCase();
	return (
		normalized.includes(`${path.sep}node_modules${path.sep}.bin${path.sep}`) ||
		normalized.includes("/node_modules/.bin/")
	);
}

/**
 * Find a usable Bun binary (global system PATH, ~/.bun/bin, or repoDir's node_modules/.bin).
 *
 * @param {string} [repoDir]
 * @returns {string | null}
 */
export function findBunExecutable(repoDir) {
	const onPath = findExecutable("bun");
	if (onPath && !isNodeModulesBinPath(onPath)) return onPath;

	const homeBun = path.join(
		os.homedir(),
		".bun",
		"bin",
		process.platform === "win32" ? "bun.exe" : "bun",
	);
	if (fs.existsSync(homeBun)) return homeBun;

	if (repoDir) {
		const localBun = path.join(
			repoDir,
			"node_modules",
			".bin",
			process.platform === "win32" ? "bun.exe" : "bun",
		);
		if (fs.existsSync(localBun)) return localBun;
		if (process.platform === "win32") {
			const localCmd = path.join(repoDir, "node_modules", ".bin", "bun.cmd");
			if (fs.existsSync(localCmd)) return localCmd;
		}
	}

	if (onPath) return onPath;
	return null;
}

/**
 * Locate a Graphify CLI executable ("graphify" or "graphify-mcp") on PATH or in ~/.local/bin.
 *
 * @param {"graphify" | "graphify-mcp"} cmd
 * @returns {string | null}
 */
export function findGraphifyExecutable(cmd) {
	const onPath = findExecutable(cmd);
	if (onPath) return onPath;

	const suffix = process.platform === "win32" ? ".exe" : "";
	const localBin = path.join(os.homedir(), ".local", "bin", `${cmd}${suffix}`);
	if (fs.existsSync(localBin)) return localBin;

	return null;
}

/**
 * Build a Graphify MCP server entry pointing at <targetDir>/graphify-out/graph.json.
 * Prefers Graphify's official Antigravity `uv run --with graphifyy --with mcp -m graphify.serve`
 * invocation when `uv` is available (ensuring `mcp` / `anyio` dependencies are always present),
 * falling back to `graphify-mcp` otherwise.
 *
 * @param {string} targetDir
 * @param {string | null} [graphifyMcpBin]
 * @returns {{ command: string; args: string[] }}
 */
export function buildGraphifyMcpEntry(targetDir, graphifyMcpBin = null) {
	const graphPath = path.join(path.resolve(targetDir), "graphify-out", "graph.json");
	if (graphifyMcpBin) {
		return {
			command: graphifyMcpBin,
			args: [graphPath],
		};
	}
	const uvBin = findExecutable("uv");
	if (uvBin) {
		return {
			command: "uv",
			args: [
				"run",
				"--with",
				"graphifyy",
				"--with",
				"mcp",
				"-m",
				"graphify.serve",
				graphPath,
			],
		};
	}
	return {
		command: "graphify-mcp",
		args: [graphPath],
	};
}

/**
 * Build a Context7 MCP server entry (@upstash/context7-mcp) for live official library documentation lookup.
 *
 * @param {{ runtime?: string; apiKey?: string }} [options]
 * @returns {{ command: string; args: string[]; env?: Record<string, string> }}
 */
export function buildContext7McpEntry(options = {}) {
	const useBunx =
		typeof options.runtime === "string" &&
		options.runtime.toLowerCase().includes("bun") &&
		Boolean(findExecutable("bunx"));
	const command = useBunx ? "bunx" : "npx";
	const apiKey = options.apiKey?.trim() || process.env.CONTEXT7_API_KEY?.trim();
	const entry = {
		command,
		args: ["-y", "@upstash/context7-mcp"],
	};
	if (apiKey) {
		entry.env = { CONTEXT7_API_KEY: apiKey };
	}
	return entry;
}

/**
 * Set up Graphify knowledge graph integration inside targetDir during initial setup:
 * - Detects graphify / graphify-mcp binaries (optionally installing graphifyy[mcp] via uv/pipx)
 * - Installs Antigravity Graphify rules/workflows (`graphify antigravity install`)
 * - Installs Git auto-update hooks (`graphify hook install`) when targetDir is a git repo
 * - Runs initial deterministic `graphify update .` when source files exist
 *
 * @param {string} targetDir
 * @param {{
 *   enabled?: boolean;
 *   installGraphify?: boolean;
 *   projectMode?: "brownfield" | "greenfield";
 *   force?: boolean;
 *   dryRun?: boolean;
 *   log?: (msg: string) => void;
 * }} [options]
 */
export function setupGraphifyForProject(targetDir, options = {}) {
	const resolvedTarget = path.resolve(targetDir);
	const log = options.log ?? ((msg) => console.log(msg));

	if (options.enabled === false) {
		return {
			enabled: false,
			installedCli: false,
			graphifyBin: null,
			graphifyMcpBin: null,
			antigravityConfigured: false,
			gitHooksInstalled: false,
			graphBuilt: false,
			graphPath: path.join(resolvedTarget, "graphify-out", "graph.json"),
			warnings: [],
		};
	}

	const warnings = [];
	let graphifyBin = findGraphifyExecutable("graphify");
	let graphifyMcpBin = findGraphifyExecutable("graphify-mcp");
	let installedCli = false;

	if ((!graphifyBin || !graphifyMcpBin || options.installGraphify) && options.installGraphify) {
		const uvBin = findExecutable("uv");
		const pipxBin = findExecutable("pipx");
		if (options.dryRun) {
			log('[dry-run] Would install Graphify with MCP support via uv/pipx: uv tool install --force "graphifyy[mcp]"');
		} else if (uvBin) {
			log('[agy-ensemble] Installing Graphify with MCP support via uv tool install "graphifyy[mcp]"...');
			const res = spawnSync(uvBin, ["tool", "install", "--force", "graphifyy[mcp]"], {
				cwd: resolvedTarget,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			});
			if (res.status === 0) {
				installedCli = true;
				graphifyBin = findGraphifyExecutable("graphify");
				graphifyMcpBin = findGraphifyExecutable("graphify-mcp");
			} else {
				warnings.push(
					`Failed to install graphifyy[mcp] via uv: ${(res.stderr || res.stdout || "").trim() || `exit ${res.status}`}`,
				);
			}
		} else if (pipxBin) {
			log('[agy-ensemble] Installing Graphify with MCP support via pipx install "graphifyy[mcp]"...');
			const res = spawnSync(pipxBin, ["install", "--force", "graphifyy[mcp]"], {
				cwd: resolvedTarget,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			});
			if (res.status === 0) {
				installedCli = true;
				graphifyBin = findGraphifyExecutable("graphify");
				graphifyMcpBin = findGraphifyExecutable("graphify-mcp");
			} else {
				warnings.push(
					`Failed to install graphifyy[mcp] via pipx: ${(res.stderr || res.stdout || "").trim() || `exit ${res.status}`}`,
				);
			}
		} else {
			warnings.push(
				'Neither uv nor pipx found on PATH. Install Graphify manually with: uv tool install "graphifyy[mcp]"',
			);
		}
	}

	if (!graphifyBin) {
		warnings.push(
			'Graphify CLI not detected on PATH. Install with: uv tool install "graphifyy[mcp]" (or re-run with --install-graphify).',
		);
		return {
			enabled: true,
			installedCli,
			graphifyBin: null,
			graphifyMcpBin,
			antigravityConfigured: false,
			gitHooksInstalled: false,
			graphBuilt: false,
			graphPath: path.join(resolvedTarget, "graphify-out", "graph.json"),
			warnings,
		};
	}

	let antigravityConfigured = false;
	let gitHooksInstalled = false;
	let graphBuilt = false;
	const graphPath = path.join(resolvedTarget, "graphify-out", "graph.json");

	if (options.dryRun) {
		return {
			enabled: true,
			installedCli,
			graphifyBin,
			graphifyMcpBin,
			antigravityConfigured: true,
			gitHooksInstalled: fs.existsSync(path.join(resolvedTarget, ".git")),
			graphBuilt: options.projectMode === "brownfield",
			graphPath,
			warnings,
		};
	}

	// 1. Configure Graphify Antigravity rules/workflows in target project (idempotent)
	const agyRulePath = path.join(resolvedTarget, ".agents", "rules", "graphify.md");
	const agyWorkflowPath = path.join(
		resolvedTarget,
		".agents",
		"workflows",
		"graphify.md",
	);
	const hasAgyGraphifyFiles =
		fs.existsSync(agyRulePath) && fs.existsSync(agyWorkflowPath);

	if (hasAgyGraphifyFiles && !options.installGraphify) {
		antigravityConfigured = true;
	} else {
		const agySetupRes = spawnSync(graphifyBin, ["antigravity", "install"], {
			cwd: resolvedTarget,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		if (agySetupRes.status === 0) {
			antigravityConfigured = true;
		} else {
			warnings.push(
				`graphify antigravity install skipped: ${(agySetupRes.stderr || agySetupRes.stdout || "").trim() || `exit ${agySetupRes.status}`}`,
			);
		}
	}

	// 2. Install Git auto-update hooks when targetDir is a git repository (idempotent)
	if (fs.existsSync(path.join(resolvedTarget, ".git"))) {
		const postCommitPath = path.join(
			resolvedTarget,
			".git",
			"hooks",
			"post-commit",
		);
		const alreadyHooked =
			fs.existsSync(postCommitPath) &&
			fs.readFileSync(postCommitPath, "utf8").toLowerCase().includes("graphify");
		if (alreadyHooked && !options.installGraphify) {
			gitHooksInstalled = true;
		} else {
			const hookRes = spawnSync(graphifyBin, ["hook", "install"], {
				cwd: resolvedTarget,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			});
			if (hookRes.status === 0) {
				gitHooksInstalled = true;
			} else {
				warnings.push(
					`graphify hook install skipped: ${(hookRes.stderr || hookRes.stdout || "").trim() || `exit ${hookRes.status}`}`,
				);
			}
		}
	}

	// 3. Build initial deterministic AST knowledge graph when code exists
	const shouldBuildGraph =
		options.projectMode === "brownfield" ||
		options.installGraphify ||
		(!fs.existsSync(graphPath) &&
			["src", "app", "packages"].some((dir) =>
				fs.existsSync(path.join(resolvedTarget, dir)),
			));

	if (shouldBuildGraph && (!fs.existsSync(graphPath) || options.installGraphify)) {
		const updateArgs = ["update", "."];
		if (options.force) updateArgs.push("--force");
		const updateRes = spawnSync(graphifyBin, updateArgs, {
			cwd: resolvedTarget,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		if (updateRes.status === 0 && fs.existsSync(graphPath)) {
			graphBuilt = true;
		} else {
			warnings.push(
				`graphify update skipped: ${(updateRes.stderr || updateRes.stdout || "").trim() || `exit ${updateRes.status}`}`,
			);
		}
	}

	return {
		enabled: true,
		installedCli,
		graphifyBin,
		graphifyMcpBin,
		antigravityConfigured,
		gitHooksInstalled,
		graphBuilt,
		graphPath,
		warnings,
	};
}

/**
 * Determine the preferred MCP runtime command (prefers Bun, falling back to Node.js).
 *
 * @param {"bun" | "node"} [preferred]
 * @param {string} [repoDir]
 * @returns {string}
 */
export function resolveMcpRuntime(preferred, repoDir) {
	if (preferred === "bun" || preferred === "node") {
		return preferred;
	}
	const onPath = findExecutable("bun");
	if (onPath && !isNodeModulesBinPath(onPath)) {
		return "bun";
	}
	const bunBin = findBunExecutable(repoDir);
	if (bunBin) {
		return bunBin;
	}
	return "node";
}

/**
 * Run a command synchronously using execFileSync (or shell on Windows for .cmd shims).
 *
 * @param {string} bin
 * @param {string[]} args
 * @param {string} cwd
 */
function runCommandSync(bin, args, cwd) {
	const needsShell =
		process.platform === "win32" && /\.(cmd|bat)$/i.test(bin);
	execFileSync(bin, args, {
		cwd,
		stdio: "inherit",
		shell: needsShell,
		env: process.env,
	});
}

/**
 * Clone or update agy-ensemble from GitHub into ensembleHome, and build dist/ if needed.
 *
 * @param {{
 *   ensembleHome?: string;
 *   sourceDir?: string;
 *   repoUrl?: string;
 *   noUpdate?: boolean;
 *   force?: boolean;
 *   dryRun?: boolean;
 *   log?: (msg: string) => void;
 * }} [options]
 * @returns {{
 *   sourceDir: string;
 *   action: "local" | "cloned" | "updated" | "up-to-date" | "offline-cached";
 *   built: boolean;
 * }}
 */
export function ensureEnsembleSource(options = {}) {
	const log = options.log ?? ((msg) => console.log(msg));
	const repoUrl = options.repoUrl ?? DEFAULT_GITHUB_REPO_URL;

	if (options.sourceDir) {
		const resolved = path.resolve(options.sourceDir);
		if (!fs.existsSync(resolved)) {
			throw new Error(`Provided --source directory does not exist: ${resolved}`);
		}
		const distMcp = path.join(resolved, "dist", "mcp-server.js");
		let built = false;
		if (
			!fs.existsSync(distMcp) &&
			fs.existsSync(path.join(resolved, "package.json")) &&
			!options.dryRun
		) {
			buildEnsembleRepo(resolved, log);
			built = true;
		}
		return { sourceDir: resolved, action: "local", built };
	}

	const ensembleHome = getDefaultEnsembleHome(options.ensembleHome);
	const gitDir = path.join(ensembleHome, ".git");
	let action = "up-to-date";
	let changed = false;

	if (!fs.existsSync(gitDir)) {
		if (
			fs.existsSync(ensembleHome) &&
			fs.readdirSync(ensembleHome).length > 0 &&
			!options.force
		) {
			throw new Error(
				`Target global install directory exists and is not a git repository: ${ensembleHome}. Use --force or --install-dir to specify another path.`,
			);
		}
		if (options.dryRun) {
			log(`[dry-run] Would clone ${repoUrl} into ${ensembleHome}`);
			return { sourceDir: ensembleHome, action: "cloned", built: false };
		}
		if (fs.existsSync(ensembleHome) && options.force) {
			fs.rmSync(ensembleHome, { recursive: true, force: true });
		}
		fs.mkdirSync(path.dirname(ensembleHome), { recursive: true });
		log(`[agy-ensemble] Cloning latest from ${repoUrl} -> ${ensembleHome}...`);
		runCommandSync(
			"git",
			["clone", "--depth", "1", repoUrl, ensembleHome],
			os.homedir(),
		);
		action = "cloned";
		changed = true;
	} else if (!options.noUpdate) {
		if (options.dryRun) {
			log(`[dry-run] Would update ${ensembleHome} from ${repoUrl}`);
			return { sourceDir: ensembleHome, action: "updated", built: false };
		}
		try {
			const beforeSha = execFileSync("git", ["-C", ensembleHome, "rev-parse", "HEAD"], {
				encoding: "utf8",
			}).trim();
			log(`[agy-ensemble] Updating ${ensembleHome} from GitHub...`);
			runCommandSync("git", ["-C", ensembleHome, "fetch", "origin"], ensembleHome);
			runCommandSync(
				"git",
				["-C", ensembleHome, "pull", "--ff-only"],
				ensembleHome,
			);
			const afterSha = execFileSync("git", ["-C", ensembleHome, "rev-parse", "HEAD"], {
				encoding: "utf8",
			}).trim();
			if (beforeSha !== afterSha) {
				action = "updated";
				changed = true;
			} else {
				action = "up-to-date";
			}
		} catch (err) {
			const distMcp = path.join(ensembleHome, "dist", "mcp-server.js");
			if (fs.existsSync(distMcp)) {
				log(
					`[agy-ensemble] Warning: could not update from remote (${err instanceof Error ? err.message : String(err)}). Using cached install at ${ensembleHome}.`,
				);
				action = "offline-cached";
			} else {
				throw err;
			}
		}
	}

	const distMcp = path.join(ensembleHome, "dist", "mcp-server.js");
	const nodeModulesDir = path.join(ensembleHome, "node_modules");
	let built = false;

	if (
		!options.dryRun &&
		(changed ||
			options.force ||
			!fs.existsSync(nodeModulesDir) ||
			!fs.existsSync(distMcp))
	) {
		buildEnsembleRepo(ensembleHome, log);
		built = true;
	}

	return { sourceDir: ensembleHome, action, built };
}

/**
 * Install dependencies and compile distribution bundles in an agy-ensemble repo directory.
 *
 * @param {string} repoDir
 * @param {(msg: string) => void} [log]
 */
export function buildEnsembleRepo(repoDir, log = (msg) => console.log(msg)) {
	const bunBin = findBunExecutable(repoDir);
	const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

	if (bunBin) {
		log(`[agy-ensemble] Installing dependencies with Bun in ${repoDir}...`);
		runCommandSync(bunBin, ["install"], repoDir);
		log("[agy-ensemble] Building dist/ bundles...");
		runCommandSync(bunBin, ["run", "build"], repoDir);
		return;
	}

	log(`[agy-ensemble] Installing dependencies with npm in ${repoDir}...`);
	runCommandSync(npmCmd, ["install", "--include=dev"], repoDir);
	log("[agy-ensemble] Building dist/ bundles...");
	runCommandSync(npmCmd, ["run", "build"], repoDir);
}

/**
 * Safely merge an MCP server entry into an mcp.json / mcp_config.json file.
 *
 * @param {string} mcpJsonPath
 * @param {string} serverName
 * @param {{ command: string; args: string[]; env?: Record<string, string> }} serverEntry
 * @param {{ dryRun?: boolean }} [options]
 * @returns {{ mcpJsonPath: string; registered: boolean; updated: boolean }}
 */
export function mergeMcpConfigFile(
	mcpJsonPath,
	serverName,
	serverEntry,
	options = {},
) {
	/** @type {{ mcpServers?: Record<string, { command: string; args: string[]; env?: Record<string, string> }> } & Record<string, unknown>} */
	let config = {};

	if (fs.existsSync(mcpJsonPath)) {
		try {
			const raw = fs.readFileSync(mcpJsonPath, "utf8");
			if (raw.trim().length > 0) {
				const parsed = JSON.parse(raw);
				if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
					config = parsed;
				}
			}
		} catch {
			config = {};
		}
	}

	if (
		!config.mcpServers ||
		typeof config.mcpServers !== "object" ||
		Array.isArray(config.mcpServers)
	) {
		config.mcpServers = {};
	}

	const isUpdated = Boolean(config.mcpServers[serverName]);
	config.mcpServers[serverName] = serverEntry;

	if (!options.dryRun) {
		fs.mkdirSync(path.dirname(mcpJsonPath), { recursive: true });
		fs.writeFileSync(mcpJsonPath, `${JSON.stringify(config, null, 2)}\n`, {
			encoding: "utf8",
		});
	}

	return {
		mcpJsonPath,
		registered: true,
		updated: isUpdated,
	};
}

/**
 * Remove a named server entry from an mcp.json file if present.
 *
 * @param {string} mcpJsonPath
 * @param {string} serverName
 * @param {{ dryRun?: boolean; removeEmptyFile?: boolean }} [options]
 * @returns {boolean}
 */
export function removeMcpServerFromFile(
	mcpJsonPath,
	serverName,
	options = {},
) {
	if (!fs.existsSync(mcpJsonPath)) return false;

	try {
		const raw = fs.readFileSync(mcpJsonPath, "utf8");
		const config = JSON.parse(raw);
		if (!config?.mcpServers?.[serverName]) {
			return false;
		}
		delete config.mcpServers[serverName];
		if (!options.dryRun) {
			const remainingServers = Object.keys(config.mcpServers).length;
			const remainingRootKeys = Object.keys(config).length;
			if (
				options.removeEmptyFile &&
				remainingServers === 0 &&
				remainingRootKeys === 1
			) {
				fs.rmSync(mcpJsonPath, { force: true });
			} else {
				fs.writeFileSync(
					mcpJsonPath,
					`${JSON.stringify(config, null, 2)}\n`,
					"utf8",
				);
			}
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * Copy plugin files as a fallback if OS forbids creating symlinks/junctions.
 *
 * @param {string} sourceDir
 * @param {string} destDir
 */
function copyPluginPayload(sourceDir, destDir) {
	const items = [
		".gemini-plugin",
		"plugin.json",
		"assets",
		"agents",
		"bin",
		"rules",
		"skills",
		"sidecars",
		"scripts",
		"dist",
		"templates",
		"hooks.json",
		"mcp_config.json",
		"package.json",
		"SKILL.md",
	];
	fs.mkdirSync(destDir, { recursive: true });
	for (const item of items) {
		const src = path.join(sourceDir, item);
		if (!fs.existsSync(src)) continue;
		const dst = path.join(destDir, item);
		fs.cpSync(src, dst, { recursive: true, force: true });
	}
}

/**
 * Read current git HEAD SHA if sourceDir is a git repo.
 *
 * @param {string} sourceDir
 * @returns {string}
 */
function readRepoHeadSha(sourceDir) {
	if (!fs.existsSync(path.join(sourceDir, ".git"))) return "local";
	try {
		return execFileSync("git", ["-C", sourceDir, "rev-parse", "HEAD"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return "local";
	}
}

/**
 * Sync the agy-ensemble plugin payload as a real directory (not a symlink/junction)
 * so Antigravity IDE / Language Server always discovers skills, rules, hooks, and MCP.
 *
 * @param {string} sourceDir
 * @param {string} destDir
 * @param {{
 *   runtime?: string;
 *   force?: boolean;
 *   dryRun?: boolean;
 * }} [options]
 * @returns {{ path: string; action: "copied" | "updated" | "exists" }}
 */
/**
 * If destDir is inside <project>/.agents/plugins/agy-ensemble, resolve <project>.
 *
 * @param {string} destDir
 * @returns {string | null}
 */
function resolveProjectRootFromPluginDir(destDir) {
	const pluginsDir = path.dirname(destDir);
	const agentsDir = path.dirname(pluginsDir);
	if (
		path.basename(pluginsDir) === "plugins" &&
		path.basename(agentsDir) === ".agents"
	) {
		return path.dirname(agentsDir);
	}
	return null;
}

/**
 * Migrate any legacy team.db written inside .agents/plugins/agy-ensemble/.ensemble/
 * up to <project>/.ensemble/ when updating an existing install.
 *
 * @param {string} pluginDir
 * @param {string} projectRootDir
 */
function migrateLegacyPluginDb(pluginDir, projectRootDir) {
	const legacyDbDir = path.join(pluginDir, ".ensemble");
	const legacyDb = path.join(legacyDbDir, "team.db");
	if (!fs.existsSync(legacyDb)) return;

	const targetDbDir = path.join(projectRootDir, ".ensemble");
	const targetDb = path.join(targetDbDir, "team.db");
	if (fs.existsSync(targetDb)) return;

	try {
		fs.mkdirSync(targetDbDir, { recursive: true });
		for (const suffix of ["", "-wal", "-shm"]) {
			const src = `${legacyDb}${suffix}`;
			if (fs.existsSync(src)) {
				fs.copyFileSync(src, `${targetDb}${suffix}`);
			}
		}
	} catch {
		// Ignore copy failure if locked
	}
}

export function syncProjectPluginDirectory(sourceDir, destDir, options = {}) {
	const resolvedSource = path.resolve(sourceDir);
	const stampPath = path.join(destDir, ".agy-ensemble-install.json");
	const headSha = readRepoHeadSha(resolvedSource);
	const projectRootDir = resolveProjectRootFromPluginDir(path.resolve(destDir));
	const expectedDbPath =
		options.expectedDbPath ||
		(projectRootDir
			? path.join(projectRootDir, ".ensemble", "team.db")
			: ".ensemble/team.db");
	const runtime = resolveMcpRuntime(options.runtime, resolvedSource);

	let existingStat = null;
	try {
		existingStat = fs.lstatSync(destDir);
	} catch {
		existingStat = null;
	}

	const isSymlink = Boolean(existingStat?.isSymbolicLink());
	let isUpToDate = false;

	if (existingStat && !isSymlink && !options.force && fs.existsSync(stampPath)) {
		try {
			const stamp = JSON.parse(fs.readFileSync(stampPath, "utf8"));
			const hasEntrySkill = fs.existsSync(
				path.join(destDir, "skills", "agy-ensemble", "SKILL.md"),
			);
			const hasBinEntry = fs.existsSync(
				path.join(destDir, "bin", "agy-ensemble.mjs"),
			);
			if (
				stamp?.sourceDir === resolvedSource &&
				stamp?.headSha === headSha &&
				stamp?.dbPath === expectedDbPath &&
				hasEntrySkill &&
				hasBinEntry
			) {
				isUpToDate = true;
			}
		} catch {
			isUpToDate = false;
		}
	}

	if (isUpToDate) {
		return { path: destDir, action: "exists" };
	}

	const action = existingStat ? "updated" : "copied";
	if (options.dryRun) {
		return { path: destDir, action };
	}

	if (projectRootDir && existingStat && !isSymlink) {
		migrateLegacyPluginDb(destDir, projectRootDir);
	}

	if (isSymlink) {
		fs.rmSync(destDir, { recursive: true, force: true });
	} else if (existingStat) {
		for (const deprecated of ["mcp.json", "hooks"]) {
			try {
				fs.rmSync(path.join(destDir, deprecated), {
					recursive: true,
					force: true,
				});
			} catch {
				// Ignore if locked by active IDE session
			}
		}
	}
	copyPluginPayload(resolvedSource, destDir);

	if (runtime) {
		const mcpServerScript = path.join(resolvedSource, "dist", "mcp-server.js");
		mergeMcpConfigFile(
			path.join(destDir, "mcp_config.json"),
			"agy-ensemble",
			{
				command: runtime,
				args: [mcpServerScript],
				env: {
					ENSEMBLE_DB_PATH: expectedDbPath,
					AGY_ENSEMBLE_DELEGATE_DEFAULT: "true",
				},
			},
			{ dryRun: false },
		);
	}

	if (options.graphify !== false && projectRootDir) {
		mergeMcpConfigFile(
			path.join(destDir, "mcp_config.json"),
			"graphify",
			buildGraphifyMcpEntry(projectRootDir, options.graphifyMcpBin ?? null),
			{ dryRun: false },
		);
	}

	if (options.context7 === false) {
		removeMcpServerFromFile(path.join(destDir, "mcp_config.json"), "context7", {
			dryRun: false,
		});
	} else {
		mergeMcpConfigFile(
			path.join(destDir, "mcp_config.json"),
			"context7",
			buildContext7McpEntry({
				runtime: options.runtime,
				apiKey: options.context7ApiKey,
			}),
			{ dryRun: false },
		);
	}

	fs.writeFileSync(
		stampPath,
		`${JSON.stringify({ sourceDir: resolvedSource, headSha, dbPath: expectedDbPath }, null, 2)}\n`,
		"utf8",
	);

	return { path: destDir, action };
}

/**
 * Detect git worktrees in projectRootDir and sync .agents/plugins/agy-ensemble
 * to each worktree so subagents in worktrees have full plugin discovery and live tracing.
 *
 * @param {string} projectRootDir
 * @param {string} sourceDir
 * @param {any} [options]
 * @returns {Array<{ worktreeDir: string; pluginPath: string }>}
 */
export function syncProjectWorktrees(projectRootDir, sourceDir, options = {}) {
	if (!projectRootDir || !fs.existsSync(path.join(projectRootDir, ".git")))
		return [];
	try {
		const out = execFileSync(
			"git",
			["-C", projectRootDir, "worktree", "list", "--porcelain"],
			{
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			},
		);
		const normalizedRoot = path.resolve(projectRootDir).toLowerCase();
		const worktreeDirs = [];
		for (const line of out.split("\n")) {
			if (line.startsWith("worktree ")) {
				const wtDir = path.resolve(line.slice("worktree ".length).trim());
				if (wtDir.toLowerCase() !== normalizedRoot && fs.existsSync(wtDir)) {
					worktreeDirs.push(wtDir);
				}
			}
		}
		const results = [];
		for (const wt of worktreeDirs) {
			const wtPluginDir = path.join(wt, ".agents", "plugins", "agy-ensemble");
			const synced = syncProjectPluginDirectory(sourceDir, wtPluginDir, {
				...options,
				expectedDbPath: path.join(projectRootDir, ".ensemble", "team.db"),
			});
			results.push({ worktreeDir: wt, pluginPath: synced.path });
		}
		return results;
	} catch {
		return [];
	}
}

/**
 * Create or update a symlink/junction (with copy fallback) from linkPath -> sourceDir.
 *
 * @param {string} sourceDir
 * @param {string} linkPath
 * @param {{ force?: boolean; dryRun?: boolean }} [options]
 * @returns {{ path: string; action: "linked" | "updated" | "exists" | "copied" }}
 */
export function createOrUpdatePluginLink(sourceDir, linkPath, options = {}) {
	const resolvedSource = path.resolve(sourceDir);
	let existingStat = null;
	try {
		existingStat = fs.lstatSync(linkPath);
	} catch {
		existingStat = null;
	}

	if (existingStat) {
		if (existingStat.isSymbolicLink()) {
			try {
				const currentTarget = fs.realpathSync(linkPath);
				const expectedTarget = fs.realpathSync(resolvedSource);
				if (currentTarget === expectedTarget && !options.force) {
					return { path: linkPath, action: "exists" };
				}
			} catch {
				// Broken symlink; replace below
			}
			if (!options.dryRun) {
				fs.rmSync(linkPath, { recursive: true, force: true });
			}
			if (!options.dryRun) {
				linkOrCopyPlugin(resolvedSource, linkPath);
			}
			return { path: linkPath, action: "updated" };
		}

		if (!options.force) {
			return { path: linkPath, action: "exists" };
		}
		if (!options.dryRun) {
			fs.rmSync(linkPath, { recursive: true, force: true });
			linkOrCopyPlugin(resolvedSource, linkPath);
		}
		return { path: linkPath, action: "updated" };
	}

	if (options.dryRun) {
		return { path: linkPath, action: "linked" };
	}

	const method = linkOrCopyPlugin(resolvedSource, linkPath);
	return { path: linkPath, action: method };
}

/**
 * @param {string} resolvedSource
 * @param {string} linkPath
 * @returns {"linked" | "copied"}
 */
function linkOrCopyPlugin(resolvedSource, linkPath) {
	fs.mkdirSync(path.dirname(linkPath), { recursive: true });
	const symlinkType = process.platform === "win32" ? "junction" : "dir";
	try {
		fs.symlinkSync(resolvedSource, linkPath, symlinkType);
		return "linked";
	} catch {
		copyPluginPayload(resolvedSource, linkPath);
		return "copied";
	}
}

/**
 * Idempotently add entries to <targetDir>/.gitignore without duplicating existing lines.
 *
 * @param {string} targetDir
 * @param {string[]} requiredEntries
 * @param {{ dryRun?: boolean }} [options]
 * @returns {{ gitignorePath: string; addedEntries: string[] }}
 */
export function ensureProjectGitignore(
	targetDir,
	requiredEntries = [".ensemble/", ".agents/plugins/agy-ensemble"],
	options = {},
) {
	const gitignorePath = path.join(targetDir, ".gitignore");
	const existingContent = fs.existsSync(gitignorePath)
		? fs.readFileSync(gitignorePath, "utf8")
		: "";
	const existingLines = new Set(
		existingContent.split(/\r?\n/).map((line) => line.trim()),
	);

	const addedEntries = requiredEntries.filter(
		(entry) => !existingLines.has(entry.trim()),
	);

	if (addedEntries.length > 0 && !options.dryRun) {
		const prefix =
			existingContent.length > 0 && !existingContent.endsWith("\n") ? "\n" : "";
		const header = existingLines.has("# agy-ensemble") ? "" : "# agy-ensemble\n";
		const block = `${prefix}${existingContent.length > 0 ? "\n" : ""}${header}${addedEntries.join("\n")}\n`;
		fs.writeFileSync(gitignorePath, `${existingContent}${block}`, "utf8");
	}

	return { gitignorePath, addedEntries };
}

/**
 * Create a starter AGENTS.md in targetDir only when none exists yet.
 *
 * @param {string} targetDir
 * @param {string} projectName
 * @param {{ dryRun?: boolean }} [options]
 * @returns {{ agentsMdPath: string; action: "created" | "preserved" }}
 */
export function ensureStarterAgentsMd(targetDir, projectName, options = {}) {
	const agentsMdPath = path.join(targetDir, "AGENTS.md");
	if (fs.existsSync(agentsMdPath)) {
		return { agentsMdPath, action: "preserved" };
	}

	const content = `# ${projectName} — Agent Governance (agy-ensemble)

This project is configured with **agy-ensemble** for Google Antigravity.

## Workflow & Quality Mandates

1. **Etapa 0.0 (Brownfield & Codebase-Doc Sync Gate):** Before adding features to an existing codebase, ensure \`README.md\`, \`AGENTS.md\`, \`CLAUDE.md\`, \`CONTEXT.md\`, \`docs/PRD.md\`, \`docs/RFC.md\`, \`docs/FDD.md\`, \`docs/DESIGN_SYSTEM.md\`, \`docs/project-plan.md\`, \`docs/TRACKER.md\`, and \`docs/VALIDATION.md\` exist and have \`0 drift\`. Run \`/init-project\` when bootstrapping an existing repository.
2. **Etapa 1.0 (Iterative Assumption Interview):** Resolve open assumptions in batches of 3–5 questions via \`ask_question\` (\`(Recommended)\` first) and synthesize the \`Requisição Consolidada Oficial\` before planning.
3. **Mandato NFR-0 & LGPD Compliance:** Enforce Brazilian LGPD (Law No. 13.709/2018) data mapping (ROPA), PII log redaction (\`[LGPD_REDACTED]\`), secret protection (Vault + Gitleaks), and OpenTelemetry observability by default.
4. **Strict Delegate Mode (\`delegate: true\`):** Use \`/agy-ensemble "<pedido>"\` to orchestrate parallel \`worker-teammate\` executions in isolated \`Workspace: 'share'\` worktrees with mandatory branch preservation.
5. **Continuous README Sync (\`README-SYNC-0\`):** Keep \`README.md\` synchronized with delivered phases, endpoints, environment variables, and test commands before merging.
6. **Graphify Knowledge Graph (\`graphify-out/\`):** Query \`graphify-out/GRAPH_REPORT.md\` and the \`graphify\` MCP server (\`query_graph\`, \`get_neighbors\`, \`shortest_path\`, \`god_nodes\`) before raw file grepping, and run \`graphify update .\` after phase merges.
`;

	if (!options.dryRun) {
		fs.writeFileSync(agentsMdPath, content, "utf8");
	}

	return { agentsMdPath, action: "created" };
}

/**
 * Sanitize a directory name into a SonarQube-compatible project key slug.
 *
 * @param {string} name
 * @returns {string}
 */
function toProjectSlug(name) {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "agy-project";
}

/**
 * Copy optional agy-ensemble templates into targetDir without clobbering existing files unless force is true.
 *
 * @param {string} sourceDir
 * @param {string} targetDir
 * @param {{ force?: boolean; dryRun?: boolean }} [options]
 * @returns {{ copied: string[]; skipped: string[] }}
 */
export function copyOptionalTemplates(sourceDir, targetDir, options = {}) {
	const projectSlug = toProjectSlug(path.basename(targetDir));
	const templateMappings = [
		{
			src: path.join("templates", ".gitleaks.toml.template"),
			dest: ".gitleaks.toml",
			executable: false,
		},
		{
			src: path.join("templates", "sonar-project.properties.template"),
			dest: "sonar-project.properties",
			executable: false,
			transform: (text) => text.replace(/\{\{PROJECT_KEY\}\}/g, projectSlug),
		},
		{
			src: path.join("templates", "docker-compose.infra.yml.template"),
			dest: "docker-compose.infra.yml",
			executable: false,
		},
		{
			src: path.join("templates", "scripts", "test-env", "run-phase-gate.sh"),
			dest: path.join("scripts", "test-env", "run-phase-gate.sh"),
			executable: true,
		},
		{
			src: path.join("templates", "DESIGN_SYSTEM.md.template"),
			dest: path.join("docs", "DESIGN_SYSTEM.md"),
			executable: false,
		},
	];

	const copied = [];
	const skipped = [];

	for (const item of templateMappings) {
		const srcPath = path.join(sourceDir, item.src);
		if (!fs.existsSync(srcPath)) continue;

		const destPath = path.join(targetDir, item.dest);
		const normalizedDest = item.dest.split(path.sep).join("/");
		if (fs.existsSync(destPath) && !options.force) {
			skipped.push(normalizedDest);
			continue;
		}

		if (!options.dryRun) {
			fs.mkdirSync(path.dirname(destPath), { recursive: true });
			let content = fs.readFileSync(srcPath, "utf8");
			if (item.transform) {
				content = item.transform(content);
			}
			fs.writeFileSync(destPath, content, "utf8");
			if (item.executable && process.platform !== "win32") {
				fs.chmodSync(destPath, 0o755);
			}
		}
		copied.push(normalizedDest);
	}

	return { copied, skipped };
}

/**
 * Detect whether targetDir is a brownfield repository (has code in src/app/packages without docs/TRACKER.md) or greenfield.
 *
 * @param {string} targetDir
 * @returns {"brownfield" | "greenfield"}
 */
export function detectProjectMode(targetDir) {
	const roots = ["src", "app", "packages"];
	let hasCode = false;

	const walk = (dir) => {
		if (hasCode || !fs.existsSync(dir)) return;
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (entry.name !== "node_modules" && entry.name !== "dist") {
					walk(path.join(dir, entry.name));
				}
			} else if (/\.(ts|tsx|js|jsx|py|go|rs|java|cs)$/.test(entry.name)) {
				hasCode = true;
				return;
			}
		}
	};

	for (const root of roots) {
		walk(path.join(targetDir, root));
	}

	const trackerExists = fs.existsSync(
		path.join(targetDir, "docs", "TRACKER.md"),
	);
	return hasCode && !trackerExists ? "brownfield" : "greenfield";
}

/**
 * Install agy-ensemble integration into a target project directory.
 *
 * @param {{
 *   targetDir?: string;
 *   ensembleHome?: string;
 *   sourceDir?: string;
 *   repoUrl?: string;
 *   antigravityDir?: string;
 *   runtime?: "bun" | "node";
 *   withTemplates?: boolean;
 *   localMcp?: boolean;
 *   noGlobal?: boolean;
 *   globalPlugin?: boolean;
 *   noUpdate?: boolean;
 *   graphify?: boolean;
 *   installGraphify?: boolean;
 *   context7?: boolean;
 *   context7ApiKey?: string;
 *   force?: boolean;
 *   dryRun?: boolean;
 *   log?: (msg: string) => void;
 * }} [options]
 */
export function installIntoProject(options = {}) {
	const log = options.log ?? ((msg) => console.log(msg));
	const targetDir = path.resolve(options.targetDir || process.cwd());

	if (!options.dryRun && !fs.existsSync(targetDir)) {
		fs.mkdirSync(targetDir, { recursive: true });
	}

	const sourceResult = ensureEnsembleSource({
		ensembleHome: options.ensembleHome,
		sourceDir: options.sourceDir,
		repoUrl: options.repoUrl,
		noUpdate: options.noUpdate,
		force: options.force,
		dryRun: options.dryRun,
		log,
	});

	const resolvedSourceDir = sourceResult.sourceDir;
	const runtime = resolveMcpRuntime(options.runtime, resolvedSourceDir);
	const mcpServerScript = path.join(resolvedSourceDir, "dist", "mcp-server.js");
	const mcpServerEntry = {
		command: runtime,
		args: [mcpServerScript],
		env: {
			ENSEMBLE_DB_PATH: ".ensemble/team.db",
			AGY_ENSEMBLE_DELEGATE_DEFAULT: "true",
		},
	};

	const projectMode = detectProjectMode(targetDir);
	const graphifyEnabled = options.graphify !== false;
	const context7Enabled = options.context7 !== false;

	// 0. Graphify Knowledge Graph initial setup (CLI detection, Antigravity rules, git hooks, initial AST graph)
	const graphifyResult = setupGraphifyForProject(targetDir, {
		enabled: graphifyEnabled,
		installGraphify: Boolean(options.installGraphify),
		projectMode,
		force: options.force,
		dryRun: options.dryRun,
		log,
	});
	const graphifyMcpEntry = buildGraphifyMcpEntry(targetDir, null);
	const context7McpEntry = buildContext7McpEntry({
		runtime,
		apiKey: options.context7ApiKey,
	});

	// 1. Sync real plugin directory into <targetDir>/.agents/plugins/agy-ensemble
	// (Antigravity's plugin/skill scanner skips Windows junctions/symlinks)
	const projectPluginLinkPath = path.join(
		targetDir,
		".agents",
		"plugins",
		"agy-ensemble",
	);
	const projectPluginResult = syncProjectPluginDirectory(
		resolvedSourceDir,
		projectPluginLinkPath,
		{
			runtime,
			graphify: graphifyEnabled,
			graphifyMcpBin: null,
			context7: context7Enabled,
			context7ApiKey: options.context7ApiKey,
			force: options.force,
			dryRun: options.dryRun,
		},
	);

	// 1b. If targetDir has git worktrees, sync .agents/plugins/agy-ensemble to each worktree too
	const worktreesResult = syncProjectWorktrees(targetDir, resolvedSourceDir, {
		runtime,
		graphify: graphifyEnabled,
		graphifyMcpBin: null,
		context7: context7Enabled,
		context7ApiKey: options.context7ApiKey,
		force: options.force,
		dryRun: options.dryRun,
	});

	// 1b. Sync plugin to any active git worktrees of targetDir
	const projectWorktreesResult = syncProjectWorktrees(
		targetDir,
		resolvedSourceDir,
		{
			runtime,
			graphify: graphifyEnabled,
			graphifyMcpBin: null,
			context7: context7Enabled,
			context7ApiKey: options.context7ApiKey,
			force: options.force,
			dryRun: options.dryRun,
		},
	);

	// 2. Ensure starter AGENTS.md if absent
	const projectName = path.basename(targetDir) || "project";
	const agentsMdResult = ensureStarterAgentsMd(targetDir, projectName, {
		dryRun: options.dryRun,
	});

	// 3. Ensure .gitignore ignores .ensemble/ and .agents/plugins/agy-ensemble
	const gitignoreResult = ensureProjectGitignore(
		targetDir,
		[".ensemble/", ".agents/plugins/agy-ensemble"],
		{ dryRun: options.dryRun },
	);

	// 4. Optional local ./mcp.json in target project
	let localMcpResult = null;
	if (options.localMcp) {
		localMcpResult = mergeMcpConfigFile(
			path.join(targetDir, "mcp.json"),
			"agy-ensemble",
			mcpServerEntry,
			{ dryRun: options.dryRun },
		);
		if (graphifyEnabled) {
			mergeMcpConfigFile(
				path.join(targetDir, "mcp.json"),
				"graphify",
				graphifyMcpEntry,
				{ dryRun: options.dryRun },
			);
		}
		if (context7Enabled) {
			mergeMcpConfigFile(
				path.join(targetDir, "mcp.json"),
				"context7",
				context7McpEntry,
				{ dryRun: options.dryRun },
			);
		}
	}

	// 5. Global Antigravity IDE integration (~/.gemini/antigravity) unless --no-global
	let globalMcpResult = null;
	let globalSkillResult = null;
	let globalPluginResult = null;
	const antigravityHome = getAntigravityHome(options.antigravityDir);

	if (!options.noGlobal) {
		globalMcpResult = mergeMcpConfigFile(
			path.join(antigravityHome, "mcp.json"),
			"agy-ensemble",
			mcpServerEntry,
			{ dryRun: options.dryRun },
		);
		if (graphifyEnabled) {
			mergeMcpConfigFile(
				path.join(antigravityHome, "mcp.json"),
				"graphify",
				graphifyMcpEntry,
				{ dryRun: options.dryRun },
			);
		}
		if (context7Enabled) {
			mergeMcpConfigFile(
				path.join(antigravityHome, "mcp.json"),
				"context7",
				context7McpEntry,
				{ dryRun: options.dryRun },
			);
		}
		globalSkillResult = createOrUpdatePluginLink(
			resolvedSourceDir,
			path.join(antigravityHome, "skills", "agy-ensemble"),
			{ force: options.force, dryRun: options.dryRun },
		);
		if (options.globalPlugin) {
			const geminiConfigDir = path.join(path.dirname(antigravityHome), "config");
			globalPluginResult = createOrUpdatePluginLink(
				resolvedSourceDir,
				path.join(geminiConfigDir, "plugins", "agy-ensemble"),
				{ force: options.force, dryRun: options.dryRun },
			);
		}
	}

	// 6. Optional project templates (--with-templates)
	const templatesResult = options.withTemplates
		? copyOptionalTemplates(resolvedSourceDir, targetDir, {
				force: options.force,
				dryRun: options.dryRun,
			})
		: { copied: [], skipped: [] };

	return {
		targetDir,
		sourceDir: resolvedSourceDir,
		sourceAction: sourceResult.action,
		built: sourceResult.built,
		runtime,
		projectMode,
		projectPlugin: projectPluginResult,
		agentsMd: agentsMdResult,
		gitignore: gitignoreResult,
		localMcp: localMcpResult,
		globalMcp: globalMcpResult,
		globalSkill: globalSkillResult,
		globalPlugin: globalPluginResult,
		templates: templatesResult,
		graphify: graphifyResult,
		context7: {
			enabled: context7Enabled,
			command: context7McpEntry.command,
			hasApiKey: Boolean(context7McpEntry.env?.CONTEXT7_API_KEY),
		},
	};
}

/**
 * Remove agy-ensemble project integration from targetDir (without deleting user code or docs).
 *
 * @param {{
 *   targetDir?: string;
 *   antigravityDir?: string;
 *   global?: boolean;
 *   dryRun?: boolean;
 * }} [options]
 */
export function uninstallFromProject(options = {}) {
	const targetDir = path.resolve(options.targetDir || process.cwd());
	const removed = [];

	const projectPluginPath = path.join(
		targetDir,
		".agents",
		"plugins",
		"agy-ensemble",
	);
	let hasProjectPlugin = false;
	try {
		fs.lstatSync(projectPluginPath);
		hasProjectPlugin = true;
	} catch {
		hasProjectPlugin = false;
	}

	if (hasProjectPlugin) {
		if (!options.dryRun) {
			fs.rmSync(projectPluginPath, { recursive: true, force: true });
		}
		removed.push(".agents/plugins/agy-ensemble");
	}

	const localMcpPath = path.join(targetDir, "mcp.json");
	if (
		removeMcpServerFromFile(localMcpPath, "agy-ensemble", {
			dryRun: options.dryRun,
			removeEmptyFile: true,
		})
	) {
		removed.push("mcp.json (agy-ensemble entry)");
	}
	if (
		removeMcpServerFromFile(localMcpPath, "graphify", {
			dryRun: options.dryRun,
			removeEmptyFile: true,
		})
	) {
		removed.push("mcp.json (graphify entry)");
	}
	if (
		removeMcpServerFromFile(localMcpPath, "context7", {
			dryRun: options.dryRun,
			removeEmptyFile: true,
		})
	) {
		removed.push("mcp.json (context7 entry)");
	}

	if (options.global) {
		const antigravityHome = getAntigravityHome(options.antigravityDir);
		const globalMcpPath = path.join(antigravityHome, "mcp.json");
		if (
			removeMcpServerFromFile(globalMcpPath, "agy-ensemble", {
				dryRun: options.dryRun,
			})
		) {
			removed.push(globalMcpPath);
		}
		removeMcpServerFromFile(globalMcpPath, "graphify", {
			dryRun: options.dryRun,
		});
		removeMcpServerFromFile(globalMcpPath, "context7", {
			dryRun: options.dryRun,
		});
		const globalSkillPath = path.join(antigravityHome, "skills", "agy-ensemble");
		let hasGlobalSkill = false;
		try {
			fs.lstatSync(globalSkillPath);
			hasGlobalSkill = true;
		} catch {
			hasGlobalSkill = false;
		}
		if (hasGlobalSkill) {
			if (!options.dryRun) {
				fs.rmSync(globalSkillPath, { recursive: true, force: true });
			}
			removed.push(globalSkillPath);
		}
	}

	return {
		targetDir,
		removed,
		uninstalled: removed.length > 0,
	};
}

/**
 * Parse installer / runner CLI arguments cleanly.
 *
 * @param {string[]} argv
 * @param {{ defaultCommand?: string }} [defaults]
 */
export function parseCliArgs(argv, defaults = {}) {
	const result = {
		command: defaults.defaultCommand ?? "install",
		explicitCommand: false,
		targetDir: undefined,
		sourceDir: undefined,
		ensembleHome: undefined,
		antigravityDir: undefined,
		runtime: undefined,
		port: undefined,
		withTemplates: false,
		localMcp: false,
		noGlobal: false,
		global: false,
		globalPlugin: false,
		noUpdate: false,
		noGraphify: false,
		installGraphify: false,
		noContext7: false,
		context7ApiKey: undefined,
		force: false,
		dryRun: false,
	};

	const knownCommands = new Set([
		"install",
		"setup",
		"run",
		"trace",
		"graphify",
		"verify",
		"status",
		"uninstall",
		"help",
	]);

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg) continue;

		if (knownCommands.has(arg)) {
			result.command = arg;
			result.explicitCommand = true;
		} else if (arg === "--install") {
			result.command = "install";
			result.explicitCommand = true;
		} else if (arg === "--setup") {
			result.command = "setup";
			result.explicitCommand = true;
		} else if (arg === "--run") {
			result.command = "run";
			result.explicitCommand = true;
		} else if (arg === "--trace") {
			result.command = "trace";
			result.explicitCommand = true;
		} else if (arg === "--verify" || arg === "test") {
			result.command = "verify";
			result.explicitCommand = true;
		} else if (arg === "--status") {
			result.command = "status";
			result.explicitCommand = true;
		} else if (arg === "--uninstall") {
			result.command = "uninstall";
			result.explicitCommand = true;
		} else if (arg === "--help" || arg === "-h") {
			result.command = "help";
			result.explicitCommand = true;
		} else if (
			(arg === "--target" || arg === "-t") &&
			i + 1 < argv.length
		) {
			result.targetDir = argv[++i];
		} else if (arg === "--source" && i + 1 < argv.length) {
			result.sourceDir = argv[++i];
		} else if (
			(arg === "--install-dir" || arg === "--home") &&
			i + 1 < argv.length
		) {
			result.ensembleHome = argv[++i];
		} else if (arg === "--antigravity-dir" && i + 1 < argv.length) {
			result.antigravityDir = argv[++i];
		} else if ((arg === "--port" || arg === "-p") && i + 1 < argv.length) {
			const parsedPort = Number.parseInt(argv[++i] ?? "", 10);
			if (!Number.isNaN(parsedPort)) {
				result.port = parsedPort;
			}
		} else if (arg === "--runtime" && i + 1 < argv.length) {
			const rt = argv[++i];
			if (rt === "bun" || rt === "node") {
				result.runtime = rt;
			}
		} else if (arg === "--with-templates") {
			result.withTemplates = true;
		} else if (arg === "--local-mcp") {
			result.localMcp = true;
		} else if (arg === "--no-global") {
			result.noGlobal = true;
		} else if (arg === "--global") {
			result.global = true;
			result.globalPlugin = true;
		} else if (arg === "--no-update") {
			result.noUpdate = true;
		} else if (arg === "--no-graphify") {
			result.noGraphify = true;
		} else if (arg === "--install-graphify") {
			result.installGraphify = true;
		} else if (arg === "--no-context7") {
			result.noContext7 = true;
		} else if (arg === "--context7-api-key" && i + 1 < argv.length) {
			result.context7ApiKey = argv[++i];
		} else if (arg === "--force" || arg === "-f") {
			result.force = true;
		} else if (arg === "--dry-run") {
			result.dryRun = true;
		} else if (!arg.startsWith("-") && !result.targetDir) {
			result.targetDir = arg;
		}
	}

	return result;
}

/**
 * Print concise installer & CLI help.
 */
export function printInstallerHelp() {
	console.log(`
==============================================================================
 agy-ensemble — Project Installer & Multi-Agent Workflow CLI
==============================================================================

Quick Install in Any Project (via bunx / npx):
  bunx github:LucasGauterio/agy-ensemble [target-dir] [options]
  bunx --no-cache github:LucasGauterio/agy-ensemble [target-dir]   (force latest)
  bun ~/.agy-ensemble/bin/agy-ensemble.mjs trace [target-dir]
  npx github:LucasGauterio/agy-ensemble [target-dir] [options]

Commands:
  install [dir]      Clone/update ~/.agy-ensemble from GitHub, build, and install
                     Antigravity plugin + MCP integration into [dir] (default: .)
  setup              Configure global Antigravity links from current repo
  run                Start the agy-ensemble MCP Server (stdio/JSON-RPC)
  trace              Launch the Mission Control Trace Graph server
  graphify [dir]     Initialize/update Graphify knowledge graph, hooks & MCP
  verify             Run full verification test suite
  status             Inspect system and active team state
  uninstall [dir]    Remove agy-ensemble integration from [dir]
  help               Show this help message

Install Options:
  --target, -t <dir>       Target project directory (default: current directory)
  --with-templates         Copy .gitleaks.toml, sonar-project.properties,
                           docker-compose.infra.yml, scripts/test-env/, DESIGN_SYSTEM.md
  --local-mcp              Also write/merge ./mcp.json in the target project
  --no-global              Skip updating ~/.gemini/antigravity/
  --global                 Also link plugin globally in ~/.gemini/config/plugins/
                           (or during uninstall, also unregister global IDE links)
  --no-update              Skip git pull when ~/.agy-ensemble already exists
  --no-graphify            Skip Graphify knowledge graph setup & MCP registration
  --install-graphify       Install/upgrade graphifyy[mcp] via uv or pipx
  --no-context7            Skip Context7 MCP (@upstash/context7-mcp) registration
  --context7-api-key <key> Optional Context7 API key for higher rate limits
  --source <dir>           Use an existing local agy-ensemble clone instead of GitHub
  --install-dir <dir>      Override ~/.agy-ensemble global clone path
  --antigravity-dir <dir>  Override ~/.gemini/antigravity path
  --runtime <bun|node>     Force MCP runtime command
  --force, -f              Overwrite existing links or templates
  --dry-run                Preview changes without writing files
`);
}

/**
 * Format and log the result of installIntoProject().
 *
 * @param {ReturnType<typeof installIntoProject>} res
 * @param {boolean} [dryRun]
 */
export function printInstallSummary(res, dryRun = false) {
	const dryTag = dryRun ? " [dry-run]" : "";
	console.log(`
==============================================================================
 agy-ensemble installed successfully${dryTag}!
==============================================================================
 Target Project:    ${res.targetDir} (${res.projectMode})
 Ensemble Source:   ${res.sourceDir} (${res.sourceAction}${res.built ? ", built" : ""})
 Project Plugin:    ${res.projectPlugin.path} (${res.projectPlugin.action})
 Governance Rules:  ${res.agentsMd.agentsMdPath} (${res.agentsMd.action})
 Gitignore:         ${res.gitignore.addedEntries.length > 0 ? `added ${res.gitignore.addedEntries.join(", ")}` : "already up to date"}
 MCP Runtime:       ${res.runtime}`);

	if (res.localMcp) {
		console.log(` Local MCP Config:  ${res.localMcp.mcpJsonPath}`);
	}
	if (res.globalMcp) {
		console.log(` Global IDE MCP:    ${res.globalMcp.mcpJsonPath}`);
	}
	if (res.globalSkill) {
		console.log(
			` Global IDE Skill:  ${res.globalSkill.path} (${res.globalSkill.action})`,
		);
	}
	if (res.graphify) {
		if (!res.graphify.enabled) {
			console.log(" Graphify:          disabled (--no-graphify)");
		} else {
			const parts = [
				res.graphify.graphifyBin ? "CLI detected" : "CLI missing",
				res.graphify.antigravityConfigured ? "Antigravity rules" : null,
				res.graphify.gitHooksInstalled ? "git hooks" : null,
				res.graphify.graphBuilt ? "graph.json built" : null,
			].filter(Boolean);
			console.log(` Graphify:          ${parts.join(", ")}`);
			for (const warning of res.graphify.warnings) {
				console.log(`   [warning] ${warning}`);
			}
		}
	}
	if (res.context7) {
		console.log(
			res.context7.enabled
				? ` Context7 MCP:      registered via ${res.context7.command} (@upstash/context7-mcp${res.context7.hasApiKey ? ", API key set" : ""})`
				: " Context7 MCP:      disabled (--no-context7)",
		);
	}
	if (res.templates.copied.length > 0 || res.templates.skipped.length > 0) {
		console.log(
			` Templates Copied:  ${res.templates.copied.length > 0 ? res.templates.copied.join(", ") : "none"}`,
		);
		if (res.templates.skipped.length > 0) {
			console.log(
				` Templates Skipped: ${res.templates.skipped.join(", ")} (already exist; pass --force to overwrite)`,
			);
		}
	}

	const nextCommand =
		res.projectMode === "brownfield"
			? '/init-project (or /agy-ensemble "sua nova feature")'
			: '/agy-ensemble "Descreva seu projeto ou feature"';

	console.log(`
 Next step inside Google Antigravity:
   Open ${res.targetDir} and invoke:
   ${nextCommand}
==============================================================================
`);
}
