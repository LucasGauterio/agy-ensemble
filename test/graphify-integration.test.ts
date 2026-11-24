import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	buildGraphifyMcpServerEntry,
	GRAPHIFY_OUTPUT_DIR,
	inspectGraphifyStatus,
	summarizeGraphifyForContextPack,
	syncProjectGraphify,
} from "../src/graphify-integration";
import {
	installIntoProject,
	PACKAGE_ROOT_DIR,
	parseCliArgs,
	setupGraphifyForProject,
	uninstallFromProject,
} from "../src/installer";
import { parseArgs } from "../src/runner";

function makeTempDir(prefix: string): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe("IMP-20 / VAL-20: Graphify Knowledge Graph & Initial Setup Integration", () => {
	test("builds MCP server entry and inspects Graphify graph status, god nodes, and staleness", () => {
		const projectDir = makeTempDir("agy-graphify-status-");
		try {
			const entry = buildGraphifyMcpServerEntry(projectDir);
			expect(entry.command).toBe("graphify-mcp");
			expect(entry.args).toEqual([
				path.join(path.resolve(projectDir), GRAPHIFY_OUTPUT_DIR, "graph.json"),
			]);

			// Create source file before graph.json -> fresh graph
			fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
			const srcFile = path.join(projectDir, "src", "service.ts");
			fs.writeFileSync(srcFile, "export function run() { return 1; }\n");

			// Before graph exists, status reports graphExists=false and isStale=true
			const before = inspectGraphifyStatus(projectDir, {
				checkBinaries: false,
			});
			expect(before.graphExists).toBe(false);
			expect(before.isStale).toBe(true);
			expect(before.gitHooksInstalled).toBe(false);

			// Write synthetic graph.json, GRAPH_REPORT.md, and post-commit hook
			const graphOutDir = path.join(projectDir, GRAPHIFY_OUTPUT_DIR);
			fs.mkdirSync(graphOutDir, { recursive: true });
			fs.writeFileSync(
				path.join(graphOutDir, "graph.json"),
				JSON.stringify(
					{
						nodes: [
							{ id: "hub", label: "CoreHub", source_file: "src/hub.ts" },
							{ id: "a", label: "ServiceA", source_file: "src/a.ts" },
							{ id: "b", label: "ServiceB", source_file: "src/b.ts" },
						],
						links: [
							{ source: "hub", target: "a" },
							{ source: "hub", target: "b" },
						],
					},
					null,
					2,
				),
			);
			fs.writeFileSync(
				path.join(graphOutDir, "GRAPH_REPORT.md"),
				"# Graphify Architecture Report\n\nCoreHub connects ServiceA and ServiceB.\n",
			);
			fs.mkdirSync(path.join(projectDir, ".git", "hooks"), {
				recursive: true,
			});
			fs.writeFileSync(
				path.join(projectDir, ".git", "hooks", "post-commit"),
				"#!/bin/sh\ngraphify update .\n",
			);

			const after = inspectGraphifyStatus(projectDir, {
				checkBinaries: false,
			});
			expect(after.graphExists).toBe(true);
			expect(after.reportExists).toBe(true);
			expect(after.nodeCount).toBe(3);
			expect(after.edgeCount).toBe(2);
			expect(after.gitHooksInstalled).toBe(true);

			const summary = summarizeGraphifyForContextPack(projectDir);
			expect(summary.available).toBe(true);
			expect(summary.nodeCount).toBe(3);
			expect(summary.edgeCount).toBe(2);
			expect(summary.godNodes[0]?.id).toBe("hub");
			expect(summary.godNodes[0]?.degree).toBe(2);
			expect(summary.reportExcerpt).toContain("CoreHub connects ServiceA");

			// Dry-run sync does not execute external processes
			const drySync = syncProjectGraphify(projectDir, {
				dryRun: true,
				graphifyBin: "graphify",
			});
			expect(drySync.dryRun).toBe(true);
			expect(drySync.updated).toBe(false);
		} finally {
			fs.rmSync(projectDir, { recursive: true, force: true });
		}
	});

	test("parses graphify subcommand and flags in both installer and runner CLIs", () => {
		const cliGraphify = parseCliArgs([
			"graphify",
			"./my-app",
			"--install-graphify",
			"--force",
		]);
		expect(cliGraphify.command).toBe("graphify");
		expect(cliGraphify.targetDir).toBe("./my-app");
		expect(cliGraphify.installGraphify).toBe(true);
		expect(cliGraphify.force).toBe(true);

		const cliNoGraphify = parseCliArgs(["./my-app", "--no-graphify"]);
		expect(cliNoGraphify.command).toBe("install");
		expect(cliNoGraphify.noGraphify).toBe(true);

		const runnerGraphify = parseArgs([
			"graphify",
			"./my-app",
			"--install-graphify",
		]);
		expect(runnerGraphify.command).toBe("graphify");
		expect(runnerGraphify.targetDir).toBe("./my-app");
		expect(runnerGraphify.installGraphify).toBe(true);

		const runnerNoGraphify = parseArgs(["setup", "--no-graphify"]);
		expect(runnerNoGraphify.command).toBe("setup");
		expect(runnerNoGraphify.noGraphify).toBe(true);
	});

	test(
		"wires Graphify MCP server during initial setup, respects --no-graphify, and cleans up on uninstall",
		() => {
			const root = makeTempDir("agy-install-graphify-");
			const targetWithGraphify = path.join(root, "with-graphify");
			const targetNoGraphify = path.join(root, "without-graphify");
			const antigravityDir = path.join(root, "antigravity");
			fs.mkdirSync(targetWithGraphify, { recursive: true });
			fs.mkdirSync(targetNoGraphify, { recursive: true });
			fs.mkdirSync(antigravityDir, { recursive: true });

			try {
				// Default install registers both agy-ensemble and graphify MCP servers
				const res = installIntoProject({
					targetDir: targetWithGraphify,
					sourceDir: PACKAGE_ROOT_DIR,
					antigravityDir,
					localMcp: true,
					runtime: "node",
					log: () => {},
				});

				expect(res.graphify.enabled).toBe(true);
				if (res.graphify.graphifyBin) {
					expect(res.graphify.antigravityConfigured).toBe(true);
					expect(
						fs.existsSync(
							path.join(targetWithGraphify, ".agents", "rules", "graphify.md"),
						),
					).toBe(true);
				}

				const pluginMcp = JSON.parse(
					fs.readFileSync(
						path.join(
							targetWithGraphify,
							".agents",
							"plugins",
							"agy-ensemble",
							"mcp_config.json",
						),
						"utf8",
					),
				);
				expect(pluginMcp.mcpServers["agy-ensemble"]).toBeDefined();
				expect(pluginMcp.mcpServers.graphify).toBeDefined();
				expect(
					pluginMcp.mcpServers.graphify.args.some((arg: string) =>
						arg.includes(path.join("graphify-out", "graph.json")),
					),
				).toBe(true);

				const localMcp = JSON.parse(
					fs.readFileSync(path.join(targetWithGraphify, "mcp.json"), "utf8"),
				);
				expect(localMcp.mcpServers.graphify).toBeDefined();

				const globalMcp = JSON.parse(
					fs.readFileSync(path.join(antigravityDir, "mcp.json"), "utf8"),
				);
				expect(globalMcp.mcpServers.graphify).toBeDefined();

				// Starter AGENTS.md mentions Graphify Knowledge Graph
				const agentsMd = fs.readFileSync(
					path.join(targetWithGraphify, "AGENTS.md"),
					"utf8",
				);
				expect(agentsMd).toContain("Graphify Knowledge Graph");

				// Opting out via graphify: false skips Graphify setup and MCP registration
				const optOutRes = installIntoProject({
					targetDir: targetNoGraphify,
					sourceDir: PACKAGE_ROOT_DIR,
					localMcp: true,
					noGlobal: true,
					graphify: false,
					runtime: "node",
					log: () => {},
				});
				expect(optOutRes.graphify.enabled).toBe(false);
				const optOutLocalMcp = JSON.parse(
					fs.readFileSync(path.join(targetNoGraphify, "mcp.json"), "utf8"),
				);
				expect(optOutLocalMcp.mcpServers.graphify).toBeUndefined();

				// Direct setupGraphifyForProject with enabled=false is a no-op
				const disabledSetup = setupGraphifyForProject(targetNoGraphify, {
					enabled: false,
				});
				expect(disabledSetup.enabled).toBe(false);

				// Uninstall removes both agy-ensemble and graphify entries cleanly
				const uninst = uninstallFromProject({
					targetDir: targetWithGraphify,
					antigravityDir,
					global: true,
				});
				expect(uninst.uninstalled).toBe(true);
				expect(fs.existsSync(path.join(targetWithGraphify, "mcp.json"))).toBe(
					false,
				);
				const globalAfter = JSON.parse(
					fs.readFileSync(path.join(antigravityDir, "mcp.json"), "utf8"),
				);
				expect(globalAfter.mcpServers.graphify).toBeUndefined();
			} finally {
				fs.rmSync(root, { recursive: true, force: true });
			}
		},
		20000,
	);
});
