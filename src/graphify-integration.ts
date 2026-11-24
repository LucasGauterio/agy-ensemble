import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Relative directory where Graphify stores its generated knowledge graph artifacts. */
export const GRAPHIFY_OUTPUT_DIR = "graphify-out";

/** Relative path to the Graphify knowledge graph JSON file. */
export const GRAPHIFY_GRAPH_FILE = "graphify-out/graph.json";

/** Relative path to the Graphify human/agent architecture summary report. */
export const GRAPHIFY_REPORT_FILE = "graphify-out/GRAPH_REPORT.md";

/** Structured status of Graphify integration inside a project directory. */
export interface GraphifyStatus {
	projectDir: string;
	graphifyInstalled: boolean;
	graphifyBin: string | null;
	graphifyMcpInstalled: boolean;
	graphifyMcpBin: string | null;
	graphExists: boolean;
	reportExists: boolean;
	graphPath: string;
	reportPath: string;
	nodeCount: number;
	edgeCount: number;
	gitHooksInstalled: boolean;
	isStale: boolean;
}

/** MCP server entry format for registering Graphify in mcp.json / mcp_config.json. */
export interface GraphifyMcpServerEntry {
	command: string;
	args: string[];
}

/** High-centrality ("god node") summary extracted from graphify-out/graph.json. */
export interface GraphifyGodNode {
	id: string;
	label: string;
	degree: number;
	sourceFile?: string;
}

/** Compact structural context extracted from Graphify for Etapa 0.0 / SI Context Packs. */
export interface GraphifyContextSummary {
	available: boolean;
	nodeCount: number;
	edgeCount: number;
	godNodes: GraphifyGodNode[];
	reportExcerpt: string;
}

/** Result returned by syncProjectGraphify(). */
export interface GraphifySyncResult {
	updated: boolean;
	dryRun: boolean;
	skippedReason?: string;
	status: GraphifyStatus;
}

interface RawGraphNode {
	id?: unknown;
	label?: unknown;
	name?: unknown;
	source_file?: unknown;
	file?: unknown;
}

interface RawGraphEdge {
	source?: unknown;
	target?: unknown;
}

interface RawGraphPayload {
	nodes?: RawGraphNode[];
	links?: RawGraphEdge[];
	edges?: RawGraphEdge[];
}

/**
 * Locate a Graphify CLI executable on PATH or in ~/.local/bin (uv/pipx default tool dir).
 *
 * @param cmd - Executable name ("graphify" or "graphify-mcp")
 * @returns Absolute path to executable, or null if not installed
 */
export function findGraphifyExecutable(
	cmd: "graphify" | "graphify-mcp",
): string | null {
	const checkCmd = process.platform === "win32" ? "where" : "which";
	const res = spawnSync(checkCmd, [cmd], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	if (res.status === 0 && res.stdout) {
		const firstLine = res.stdout
			.split(/\r?\n/)
			.find((line) => line.trim().length > 0);
		if (firstLine) {
			return firstLine.trim();
		}
	}

	const suffix = process.platform === "win32" ? ".exe" : "";
	const localBin = path.join(os.homedir(), ".local", "bin", `${cmd}${suffix}`);
	if (fs.existsSync(localBin)) {
		return localBin;
	}

	return null;
}

/**
 * Build the MCP server configuration entry for Graphify pointing at a project's graph.json.
 *
 * @param projectDir - Target project root directory
 * @param options - Optional command override (defaults to "graphify-mcp")
 * @returns GraphifyMcpServerEntry compatible with Antigravity mcp.json / mcp_config.json
 */
export function buildGraphifyMcpServerEntry(
	projectDir: string,
	options: { command?: string } = {},
): GraphifyMcpServerEntry {
	const resolvedProjectDir = path.resolve(projectDir);
	const graphPath = path.join(
		resolvedProjectDir,
		GRAPHIFY_OUTPUT_DIR,
		"graph.json",
	);
	return {
		command: options.command ?? "graphify-mcp",
		args: [graphPath],
	};
}

function parseRawGraph(graphPath: string): RawGraphPayload | null {
	if (!fs.existsSync(graphPath)) return null;
	try {
		const raw = fs.readFileSync(graphPath, "utf8");
		const parsed = JSON.parse(raw) as RawGraphPayload;
		if (!parsed || typeof parsed !== "object") return null;
		return parsed;
	} catch {
		return null;
	}
}

function findLatestSourceMtimeMs(projectDir: string): number {
	const roots = ["src", "app", "packages"];
	let latest = 0;

	const walk = (dir: string): void => {
		if (!fs.existsSync(dir)) return;
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (
					entry.name !== "node_modules" &&
					entry.name !== "dist" &&
					entry.name !== GRAPHIFY_OUTPUT_DIR
				) {
					walk(fullPath);
				}
			} else if (/\.(ts|tsx|js|jsx|py|go|rs|java|cs)$/.test(entry.name)) {
				try {
					const stat = fs.statSync(fullPath);
					if (stat.mtimeMs > latest) {
						latest = stat.mtimeMs;
					}
				} catch {
					// Ignore transient stat failures
				}
			}
		}
	};

	for (const root of roots) {
		walk(path.join(projectDir, root));
	}

	return latest;
}

function hasGraphifyGitHook(projectDir: string): boolean {
	const hookPath = path.join(projectDir, ".git", "hooks", "post-commit");
	if (!fs.existsSync(hookPath)) return false;
	try {
		const content = fs.readFileSync(hookPath, "utf8");
		return content.toLowerCase().includes("graphify");
	} catch {
		return false;
	}
}

/**
 * Inspect the Graphify knowledge graph status, CLI availability, hook state, and staleness.
 *
 * @param projectDir - Target project root directory
 * @param options - Optional flags (set checkBinaries=false in unit tests to skip PATH lookups)
 * @returns GraphifyStatus snapshot
 */
export function inspectGraphifyStatus(
	projectDir: string,
	options: { checkBinaries?: boolean } = {},
): GraphifyStatus {
	const resolvedDir = path.resolve(projectDir);
	const graphPath = path.join(resolvedDir, GRAPHIFY_OUTPUT_DIR, "graph.json");
	const reportPath = path.join(
		resolvedDir,
		GRAPHIFY_OUTPUT_DIR,
		"GRAPH_REPORT.md",
	);

	const checkBinaries = options.checkBinaries !== false;
	const graphifyBin = checkBinaries ? findGraphifyExecutable("graphify") : null;
	const graphifyMcpBin = checkBinaries
		? findGraphifyExecutable("graphify-mcp")
		: null;

	const graphExists = fs.existsSync(graphPath);
	const reportExists = fs.existsSync(reportPath);

	let nodeCount = 0;
	let edgeCount = 0;
	if (graphExists) {
		const payload = parseRawGraph(graphPath);
		if (payload) {
			nodeCount = Array.isArray(payload.nodes) ? payload.nodes.length : 0;
			const edges = Array.isArray(payload.links)
				? payload.links
				: Array.isArray(payload.edges)
					? payload.edges
					: [];
			edgeCount = edges.length;
		}
	}

	let isStale = false;
	if (graphExists) {
		try {
			const graphMtime = fs.statSync(graphPath).mtimeMs;
			const latestSourceMtime = findLatestSourceMtimeMs(resolvedDir);
			isStale = latestSourceMtime > graphMtime;
		} catch {
			isStale = false;
		}
	} else {
		isStale = findLatestSourceMtimeMs(resolvedDir) > 0;
	}

	return {
		projectDir: resolvedDir,
		graphifyInstalled: graphifyBin !== null,
		graphifyBin,
		graphifyMcpInstalled: graphifyMcpBin !== null,
		graphifyMcpBin,
		graphExists,
		reportExists,
		graphPath,
		reportPath,
		nodeCount,
		edgeCount,
		gitHooksInstalled: hasGraphifyGitHook(resolvedDir),
		isStale,
	};
}

/**
 * Extract a compact structural summary (top god nodes + GRAPH_REPORT.md excerpt)
 * for injection into Etapa 0.0 Brownfield analysis or SI Context Packs.
 *
 * @param projectDir - Target project root directory
 * @param options - Truncation and top-N god node limits
 * @returns GraphifyContextSummary
 */
export function summarizeGraphifyForContextPack(
	projectDir: string,
	options: { maxReportChars?: number; topGodNodes?: number } = {},
): GraphifyContextSummary {
	const resolvedDir = path.resolve(projectDir);
	const graphPath = path.join(resolvedDir, GRAPHIFY_OUTPUT_DIR, "graph.json");
	const reportPath = path.join(
		resolvedDir,
		GRAPHIFY_OUTPUT_DIR,
		"GRAPH_REPORT.md",
	);
	const maxReportChars = options.maxReportChars ?? 4000;
	const topGodNodesCount = options.topGodNodes ?? 8;

	const payload = parseRawGraph(graphPath);
	const reportRaw = fs.existsSync(reportPath)
		? fs.readFileSync(reportPath, "utf8")
		: "";
	const reportExcerpt =
		reportRaw.length > maxReportChars
			? `${reportRaw.slice(0, maxReportChars)}\n...[truncated]`
			: reportRaw;

	if (!payload) {
		return {
			available: reportExcerpt.length > 0,
			nodeCount: 0,
			edgeCount: 0,
			godNodes: [],
			reportExcerpt,
		};
	}

	const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
	const edges = Array.isArray(payload.links)
		? payload.links
		: Array.isArray(payload.edges)
			? payload.edges
			: [];

	const degreeMap = new Map<string, number>();
	for (const edge of edges) {
		const src = typeof edge.source === "string" ? edge.source : undefined;
		const tgt = typeof edge.target === "string" ? edge.target : undefined;
		if (src) degreeMap.set(src, (degreeMap.get(src) ?? 0) + 1);
		if (tgt) degreeMap.set(tgt, (degreeMap.get(tgt) ?? 0) + 1);
	}

	const nodeEntries: GraphifyGodNode[] = nodes
		.map((node) => {
			const id = typeof node.id === "string" ? node.id : String(node.id ?? "");
			const label =
				typeof node.label === "string"
					? node.label
					: typeof node.name === "string"
						? node.name
						: id;
			const sourceFile =
				typeof node.source_file === "string"
					? node.source_file
					: typeof node.file === "string"
						? node.file
						: undefined;
			return {
				id,
				label,
				degree: degreeMap.get(id) ?? 0,
				sourceFile,
			};
		})
		.filter((n) => n.id.length > 0)
		.sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id))
		.slice(0, topGodNodesCount);

	return {
		available: true,
		nodeCount: nodes.length,
		edgeCount: edges.length,
		godNodes: nodeEntries,
		reportExcerpt,
	};
}

/**
 * Deterministically build or refresh a project's Graphify knowledge graph using `graphify update .` (zero LLM cost).
 *
 * @param projectDir - Target project root directory
 * @param options - Execution options (force rebuild, dryRun, custom graphify binary)
 * @returns GraphifySyncResult
 */
export function syncProjectGraphify(
	projectDir: string,
	options: { force?: boolean; dryRun?: boolean; graphifyBin?: string } = {},
): GraphifySyncResult {
	const resolvedDir = path.resolve(projectDir);
	const graphifyBin = options.graphifyBin ?? findGraphifyExecutable("graphify");

	if (!graphifyBin) {
		return {
			updated: false,
			dryRun: Boolean(options.dryRun),
			skippedReason:
				'Graphify CLI not found on PATH. Install with: uv tool install "graphifyy[mcp]"',
			status: inspectGraphifyStatus(resolvedDir, { checkBinaries: false }),
		};
	}

	if (options.dryRun) {
		return {
			updated: false,
			dryRun: true,
			skippedReason: "dry-run mode",
			status: inspectGraphifyStatus(resolvedDir),
		};
	}

	const args = ["update", "."];
	if (options.force) {
		args.push("--force");
	}

	const res = spawnSync(graphifyBin, args, {
		cwd: resolvedDir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

	const status = inspectGraphifyStatus(resolvedDir);
	if (res.status !== 0) {
		const errText = (res.stderr || res.stdout || "").trim();
		return {
			updated: false,
			dryRun: false,
			skippedReason: errText || `graphify update exited with code ${res.status}`,
			status,
		};
	}

	return {
		updated: true,
		dryRun: false,
		status,
	};
}
