export const DEFAULT_GITHUB_REPO_URL: string;
export const PACKAGE_ROOT_DIR: string;

export interface EnsureSourceOptions {
	ensembleHome?: string;
	sourceDir?: string;
	repoUrl?: string;
	noUpdate?: boolean;
	force?: boolean;
	dryRun?: boolean;
	log?: (msg: string) => void;
}

export interface EnsureSourceResult {
	sourceDir: string;
	action: "local" | "cloned" | "updated" | "up-to-date" | "offline-cached";
	built: boolean;
}

export interface McpServerEntry {
	command: string;
	args: string[];
	env?: Record<string, string>;
}

export interface McpMergeResult {
	mcpJsonPath: string;
	registered: boolean;
	updated: boolean;
}

export interface LinkResult {
	path: string;
	action: "linked" | "updated" | "exists" | "copied";
}

export interface ProjectInstallOptions {
	targetDir?: string;
	ensembleHome?: string;
	sourceDir?: string;
	repoUrl?: string;
	antigravityDir?: string;
	runtime?: "bun" | "node";
	withTemplates?: boolean;
	localMcp?: boolean;
	noGlobal?: boolean;
	globalPlugin?: boolean;
	noUpdate?: boolean;
	force?: boolean;
	dryRun?: boolean;
	log?: (msg: string) => void;
}

export interface ProjectInstallResult {
	targetDir: string;
	sourceDir: string;
	sourceAction: EnsureSourceResult["action"];
	built: boolean;
	runtime: string;
	projectMode: "brownfield" | "greenfield";
	projectPlugin: LinkResult;
	agentsMd: { agentsMdPath: string; action: "created" | "preserved" };
	gitignore: { gitignorePath: string; addedEntries: string[] };
	localMcp: McpMergeResult | null;
	globalMcp: McpMergeResult | null;
	globalSkill: LinkResult | null;
	globalPlugin: LinkResult | null;
	templates: { copied: string[]; skipped: string[] };
}

export interface ProjectUninstallOptions {
	targetDir?: string;
	antigravityDir?: string;
	global?: boolean;
	dryRun?: boolean;
}

export interface ProjectUninstallResult {
	targetDir: string;
	removed: string[];
	uninstalled: boolean;
}

export interface ParsedCliArgs {
	command:
		| "install"
		| "setup"
		| "run"
		| "trace"
		| "verify"
		| "status"
		| "uninstall"
		| "help";
	explicitCommand: boolean;
	targetDir?: string;
	sourceDir?: string;
	ensembleHome?: string;
	antigravityDir?: string;
	runtime?: "bun" | "node";
	port?: number;
	withTemplates: boolean;
	localMcp: boolean;
	noGlobal: boolean;
	global: boolean;
	globalPlugin: boolean;
	noUpdate: boolean;
	force: boolean;
	dryRun: boolean;
}

export function getDefaultEnsembleHome(override?: string): string;
export function getAntigravityHome(override?: string): string;
export function findExecutable(cmd: string): string | null;
export function findBunExecutable(repoDir?: string): string | null;
export function resolveMcpRuntime(
	preferred?: "bun" | "node",
	repoDir?: string,
): string;
export function ensureEnsembleSource(
	options?: EnsureSourceOptions,
): EnsureSourceResult;
export function buildEnsembleRepo(
	repoDir: string,
	log?: (msg: string) => void,
): void;
export function mergeMcpConfigFile(
	mcpJsonPath: string,
	serverName: string,
	serverEntry: McpServerEntry,
	options?: { dryRun?: boolean },
): McpMergeResult;
export function removeMcpServerFromFile(
	mcpJsonPath: string,
	serverName: string,
	options?: { dryRun?: boolean; removeEmptyFile?: boolean },
): boolean;
export function createOrUpdatePluginLink(
	sourceDir: string,
	linkPath: string,
	options?: { force?: boolean; dryRun?: boolean },
): LinkResult;
export function ensureProjectGitignore(
	targetDir: string,
	requiredEntries?: string[],
	options?: { dryRun?: boolean },
): { gitignorePath: string; addedEntries: string[] };
export function ensureStarterAgentsMd(
	targetDir: string,
	projectName: string,
	options?: { dryRun?: boolean },
): { agentsMdPath: string; action: "created" | "preserved" };
export function copyOptionalTemplates(
	sourceDir: string,
	targetDir: string,
	options?: { force?: boolean; dryRun?: boolean },
): { copied: string[]; skipped: string[] };
export function detectProjectMode(
	targetDir: string,
): "brownfield" | "greenfield";
export function installIntoProject(
	options?: ProjectInstallOptions,
): ProjectInstallResult;
export function uninstallFromProject(
	options?: ProjectUninstallOptions,
): ProjectUninstallResult;
export function parseCliArgs(
	argv: string[],
	defaults?: { defaultCommand?: ParsedCliArgs["command"] },
): ParsedCliArgs;
export function printInstallerHelp(): void;
export function printInstallSummary(
	res: ProjectInstallResult,
	dryRun?: boolean,
): void;
