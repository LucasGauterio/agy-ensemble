import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	ensureEnsembleSource,
	installIntoProject,
	PACKAGE_ROOT_DIR,
	parseCliArgs,
	uninstallFromProject,
} from "../src/installer";

function makeTempDir(prefix: string): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe("IMP-19 / VAL-19: npx Project Installer & Antigravity Plugin Manifests", () => {
	test("parses npx installer CLI arguments and flags accurately", () => {
		const defaultParsed = parseCliArgs([]);
		expect(defaultParsed.command).toBe("install");
		expect(defaultParsed.explicitCommand).toBe(false);

		const fullParsed = parseCliArgs([
			"./my-app",
			"--with-templates",
			"--local-mcp",
			"--no-global",
			"--no-update",
			"--runtime",
			"node",
			"--force",
			"--dry-run",
		]);
		expect(fullParsed.command).toBe("install");
		expect(fullParsed.targetDir).toBe("./my-app");
		expect(fullParsed.withTemplates).toBe(true);
		expect(fullParsed.localMcp).toBe(true);
		expect(fullParsed.noGlobal).toBe(true);
		expect(fullParsed.noUpdate).toBe(true);
		expect(fullParsed.runtime).toBe("node");
		expect(fullParsed.force).toBe(true);
		expect(fullParsed.dryRun).toBe(true);

		const explicitUninstall = parseCliArgs([
			"uninstall",
			"--target",
			"/tmp/demo",
			"--global",
		]);
		expect(explicitUninstall.command).toBe("uninstall");
		expect(explicitUninstall.targetDir).toBe("/tmp/demo");
		expect(explicitUninstall.global).toBe(true);
	});

	test("installs agy-ensemble into a greenfield project with plugin link, AGENTS.md, .gitignore, and global MCP/skill", () => {
		const root = makeTempDir("agy-install-greenfield-");
		const targetDir = path.join(root, "greenfield-app");
		const antigravityDir = path.join(root, "antigravity");
		fs.mkdirSync(targetDir, { recursive: true });
		fs.mkdirSync(antigravityDir, { recursive: true });

		// Seed existing MCP server to ensure merge never clobbers
		fs.writeFileSync(
			path.join(antigravityDir, "mcp.json"),
			JSON.stringify(
				{
					mcpServers: {
						"other-tool": { command: "npx", args: ["-y", "other-mcp"] },
					},
				},
				null,
				2,
			),
		);

		try {
			const res = installIntoProject({
				targetDir,
				sourceDir: PACKAGE_ROOT_DIR,
				antigravityDir,
				runtime: "node",
				log: () => {},
			});

			expect(res.projectMode).toBe("greenfield");
			expect(res.projectPlugin.action).toBe("copied");
			const pluginStat = fs.lstatSync(
				path.join(targetDir, ".agents", "plugins", "agy-ensemble"),
			);
			expect(pluginStat.isSymbolicLink()).toBe(false);
			expect(pluginStat.isDirectory()).toBe(true);
			expect(
				fs.existsSync(
					path.join(
						targetDir,
						".agents",
						"plugins",
						"agy-ensemble",
						".gemini-plugin",
						"plugin.json",
					),
				),
			).toBe(true);
			expect(
				fs.existsSync(
					path.join(
						targetDir,
						".agents",
						"plugins",
						"agy-ensemble",
						"skills",
						"agy-ensemble",
						"SKILL.md",
					),
				),
			).toBe(true);

			expect(res.agentsMd.action).toBe("created");
			const agentsContent = fs.readFileSync(
				path.join(targetDir, "AGENTS.md"),
				"utf8",
			);
			expect(agentsContent).toContain("greenfield-app");
			expect(agentsContent).toContain("Etapa 0.0");

			const gitignoreContent = fs.readFileSync(
				path.join(targetDir, ".gitignore"),
				"utf8",
			);
			expect(gitignoreContent).toContain(".ensemble/");
			expect(gitignoreContent).toContain(".agents/plugins/agy-ensemble");

			// Local ./mcp.json is not created unless --local-mcp
			expect(res.localMcp).toBeNull();
			expect(fs.existsSync(path.join(targetDir, "mcp.json"))).toBe(false);

			// Global Antigravity IDE integration preserved existing server
			const globalMcp = JSON.parse(
				fs.readFileSync(path.join(antigravityDir, "mcp.json"), "utf8"),
			);
			expect(globalMcp.mcpServers["other-tool"]).toBeDefined();
			expect(globalMcp.mcpServers["agy-ensemble"].command).toBe("node");
			expect(globalMcp.mcpServers["agy-ensemble"].args[0]).toContain(
				"mcp-server.js",
			);
			expect(
				fs.existsSync(path.join(antigravityDir, "skills", "agy-ensemble")),
			).toBe(true);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	test("detects brownfield projects, preserves existing AGENTS.md/.gitignore, and remains idempotent across runs", () => {
		const root = makeTempDir("agy-install-brownfield-");
		const targetDir = path.join(root, "existing-api");
		const antigravityDir = path.join(root, "antigravity");
		fs.mkdirSync(path.join(targetDir, "src"), { recursive: true });
		fs.writeFileSync(
			path.join(targetDir, "src", "server.ts"),
			"export const up = true;\n",
		);
		fs.writeFileSync(
			path.join(targetDir, "AGENTS.md"),
			"# Custom Team Rules\nDo not overwrite me.\n",
		);
		fs.writeFileSync(
			path.join(targetDir, ".gitignore"),
			"node_modules/\ndist/\n",
		);

		try {
			const first = installIntoProject({
				targetDir,
				sourceDir: PACKAGE_ROOT_DIR,
				antigravityDir,
				noGlobal: true,
				log: () => {},
			});

			expect(first.runtime.toLowerCase()).toContain("bun");
			expect(first.projectMode).toBe("brownfield");
			expect(first.agentsMd.action).toBe("preserved");
			expect(
				fs.readFileSync(path.join(targetDir, "AGENTS.md"), "utf8"),
			).toContain("Do not overwrite me.");
			expect(first.gitignore.addedEntries).toEqual([
				".ensemble/",
				".agents/plugins/agy-ensemble",
			]);
			expect(first.globalMcp).toBeNull();
			expect(fs.existsSync(path.join(antigravityDir, "mcp.json"))).toBe(false);

			// Second install must be completely idempotent
			const second = installIntoProject({
				targetDir,
				sourceDir: PACKAGE_ROOT_DIR,
				antigravityDir,
				noGlobal: true,
				log: () => {},
			});
			expect(second.projectPlugin.action).toBe("exists");
			expect(second.gitignore.addedEntries).toHaveLength(0);

			// Legacy symlink/junction at .agents/plugins/agy-ensemble must be replaced with a real directory
			const pluginDir = path.join(
				targetDir,
				".agents",
				"plugins",
				"agy-ensemble",
			);
			fs.rmSync(pluginDir, { recursive: true, force: true });
			fs.symlinkSync(
				PACKAGE_ROOT_DIR,
				pluginDir,
				process.platform === "win32" ? "junction" : "dir",
			);
			expect(fs.lstatSync(pluginDir).isSymbolicLink()).toBe(true);

			const upgraded = installIntoProject({
				targetDir,
				sourceDir: PACKAGE_ROOT_DIR,
				antigravityDir,
				noGlobal: true,
				log: () => {},
			});
			expect(upgraded.projectPlugin.action).toBe("updated");
			expect(fs.lstatSync(pluginDir).isSymbolicLink()).toBe(false);
			expect(fs.lstatSync(pluginDir).isDirectory()).toBe(true);

			const gitignoreLines = fs
				.readFileSync(path.join(targetDir, ".gitignore"), "utf8")
				.split(/\r?\n/)
				.filter((l) => l.trim() === ".ensemble/");
			expect(gitignoreLines).toHaveLength(1);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	test("copies optional templates (--with-templates), writes local mcp.json (--local-mcp), and respects --force", () => {
		const root = makeTempDir("agy-install-templates-");
		const targetDir = path.join(root, "My Sample App!");
		fs.mkdirSync(targetDir, { recursive: true });
		fs.writeFileSync(
			path.join(targetDir, "mcp.json"),
			JSON.stringify({ mcpServers: { db: { command: "sqlite" } } }, null, 2),
		);

		try {
			const res = installIntoProject({
				targetDir,
				sourceDir: PACKAGE_ROOT_DIR,
				withTemplates: true,
				localMcp: true,
				noGlobal: true,
				runtime: "node",
				log: () => {},
			});

			expect(res.templates.copied).toContain(".gitleaks.toml");
			expect(res.templates.copied).toContain("sonar-project.properties");
			expect(res.templates.copied).toContain("docker-compose.infra.yml");
			expect(res.templates.copied).toContain(
				"scripts/test-env/run-phase-gate.sh",
			);
			expect(res.templates.copied).toContain("docs/DESIGN_SYSTEM.md");

			const sonarProps = fs.readFileSync(
				path.join(targetDir, "sonar-project.properties"),
				"utf8",
			);
			expect(sonarProps).toContain("sonar.projectKey=my-sample-app");
			expect(sonarProps).not.toContain("{{PROJECT_KEY}}");

			const localMcp = JSON.parse(
				fs.readFileSync(path.join(targetDir, "mcp.json"), "utf8"),
			);
			expect(localMcp.mcpServers.db).toBeDefined();
			expect(localMcp.mcpServers["agy-ensemble"]).toBeDefined();

			// Modify template and verify re-run skips without --force
			const gitleaksPath = path.join(targetDir, ".gitleaks.toml");
			fs.writeFileSync(gitleaksPath, "# custom rule\n");

			const rerun = installIntoProject({
				targetDir,
				sourceDir: PACKAGE_ROOT_DIR,
				withTemplates: true,
				noGlobal: true,
				log: () => {},
			});
			expect(rerun.templates.skipped).toContain(".gitleaks.toml");
			expect(fs.readFileSync(gitleaksPath, "utf8")).toBe("# custom rule\n");

			// With --force, templates are refreshed
			const forced = installIntoProject({
				targetDir,
				sourceDir: PACKAGE_ROOT_DIR,
				withTemplates: true,
				noGlobal: true,
				force: true,
				log: () => {},
			});
			expect(forced.templates.copied).toContain(".gitleaks.toml");
			expect(fs.readFileSync(gitleaksPath, "utf8")).toContain("generic-api-key");
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	test("supports --dry-run without modifying filesystem and cleanly uninstalls from project", () => {
		const root = makeTempDir("agy-install-dry-uninstall-");
		const targetDir = path.join(root, "demo-proj");
		const antigravityDir = path.join(root, "antigravity");
		fs.mkdirSync(targetDir, { recursive: true });

		try {
			const dryRes = installIntoProject({
				targetDir,
				sourceDir: PACKAGE_ROOT_DIR,
				antigravityDir,
				withTemplates: true,
				localMcp: true,
				dryRun: true,
				log: () => {},
			});
			expect(dryRes.agentsMd.action).toBe("created");
			expect(fs.existsSync(path.join(targetDir, ".agents"))).toBe(false);
			expect(fs.existsSync(path.join(targetDir, "AGENTS.md"))).toBe(false);
			expect(fs.existsSync(path.join(targetDir, "mcp.json"))).toBe(false);
			expect(fs.existsSync(antigravityDir)).toBe(false);

			// Dry-run clone check (zero network call)
			const cloneDry = ensureEnsembleSource({
				ensembleHome: path.join(root, ".agy-ensemble-dry"),
				dryRun: true,
				log: () => {},
			});
			expect(cloneDry.action).toBe("cloned");
			expect(
				fs.existsSync(path.join(root, ".agy-ensemble-dry")),
			).toBe(false);

			// Real install then project uninstall
			installIntoProject({
				targetDir,
				sourceDir: PACKAGE_ROOT_DIR,
				antigravityDir,
				localMcp: true,
				log: () => {},
			});

			const uninst = uninstallFromProject({
				targetDir,
				antigravityDir,
				global: true,
			});
			expect(uninst.uninstalled).toBe(true);
			expect(
				fs.existsSync(path.join(targetDir, ".agents", "plugins", "agy-ensemble")),
			).toBe(false);
			expect(fs.existsSync(path.join(targetDir, "mcp.json"))).toBe(false);
			// User governance doc AGENTS.md is preserved on uninstall
			expect(fs.existsSync(path.join(targetDir, "AGENTS.md"))).toBe(true);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	test("executes bin/agy-ensemble.mjs via Bun directly (bunx entrypoint simulation)", () => {
		const root = makeTempDir("agy-bunx-bin-");
		const targetDir = path.join(root, "bunx-target");
		const antigravityDir = path.join(root, "antigravity");
		fs.mkdirSync(targetDir, { recursive: true });

		const binPath = path.join(PACKAGE_ROOT_DIR, "bin", "agy-ensemble.mjs");

		try {
			const helpOut = execFileSync(process.execPath, [binPath, "--help"], {
				cwd: targetDir,
				encoding: "utf8",
			});
			expect(helpOut).toContain("bunx github:LucasGauterio/agy-ensemble");

			// Invoke with no explicit subcommand from inside target project (default -> install)
			const installOut = execFileSync(
				process.execPath,
				[
					binPath,
					"--source",
					PACKAGE_ROOT_DIR,
					"--antigravity-dir",
					antigravityDir,
					"--with-templates",
					"--local-mcp",
				],
				{
					cwd: targetDir,
					encoding: "utf8",
				},
			);
			expect(installOut).toContain("agy-ensemble installed successfully");
			expect(
				fs.existsSync(
					path.join(
						targetDir,
						".agents",
						"plugins",
						"agy-ensemble",
						"mcp_config.json",
					),
				),
			).toBe(true);
			expect(fs.existsSync(path.join(targetDir, ".gitleaks.toml"))).toBe(true);
			expect(fs.existsSync(path.join(targetDir, "mcp.json"))).toBe(true);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});

