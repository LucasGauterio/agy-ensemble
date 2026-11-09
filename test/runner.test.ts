import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	checkTeamStatus,
	detectRuntime,
	getAntigravityHome,
	parseArgs,
	registerMcpServer,
	setupSkillLink,
	unregisterMcpServer,
} from "../src/runner";

describe("IMP-18 / VAL-18: Single Script Setup & Run Architecture (CLI Runner)", () => {
	test("parses subcommands and flags correctly", () => {
		expect(parseArgs(["setup"]).command).toBe("setup");
		expect(parseArgs(["run"]).command).toBe("run");
		expect(parseArgs(["trace", "--port", "4242"]).command).toBe("trace");
		expect(parseArgs(["trace", "--port", "4242"]).port).toBe(4242);
		expect(parseArgs(["verify"]).command).toBe("verify");
		expect(parseArgs(["status"]).command).toBe("status");
		expect(parseArgs(["uninstall"]).command).toBe("uninstall");
		expect(parseArgs(["--run"]).command).toBe("run");
		expect(parseArgs(["--antigravity-dir", "/custom/dir"]).antigravityDir).toBe(
			"/custom/dir",
		);
	});

	test("resolves antigravity home directory with environment override and fallback", () => {
		const customDir = path.join(os.tmpdir(), "custom-antigravity-test");
		expect(getAntigravityHome(customDir)).toBe(customDir);

		const origEnv = process.env.ANTIGRAVITY_HOME;
		try {
			process.env.ANTIGRAVITY_HOME = customDir;
			expect(getAntigravityHome()).toBe(customDir);
		} finally {
			if (origEnv !== undefined) {
				process.env.ANTIGRAVITY_HOME = origEnv;
			} else {
				delete process.env.ANTIGRAVITY_HOME;
			}
		}

		// Fallback when no override is set
		delete process.env.ANTIGRAVITY_HOME;
		expect(getAntigravityHome()).toBe(
			path.join(os.homedir(), ".gemini", "antigravity"),
		);
	});

	test("detects available runtime (bun or node)", () => {
		const runtimeInfo = detectRuntime();
		expect(["bun", "node"]).toContain(runtimeInfo.runtime);
		expect(typeof runtimeInfo.execPath).toBe("string");
		expect(runtimeInfo.execPath.length).toBeGreaterThan(0);
	});

	test("registers and safely merges agy-ensemble into mcp.json without clobbering existing servers", () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), "agy-ensemble-test-mcp-"),
		);
		const mcpJsonPath = path.join(tempDir, "mcp.json");

		// Seed with an existing server
		const initialConfig = {
			mcpServers: {
				"existing-server": {
					command: "python",
					args: ["-m", "server"],
				},
			},
		};
		fs.writeFileSync(mcpJsonPath, JSON.stringify(initialConfig, null, 2));

		const mockProjectDir = path.join(tempDir, "project");
		fs.mkdirSync(mockProjectDir, { recursive: true });

		const result = registerMcpServer(mockProjectDir, tempDir, {
			runtime: "bun",
		});
		expect(result.registered).toBe(true);
		expect(result.mcpJsonPath).toBe(mcpJsonPath);

		// Verify contents
		const updatedRaw = fs.readFileSync(mcpJsonPath, "utf-8");
		const updated = JSON.parse(updatedRaw);

		expect(updated.mcpServers["existing-server"]).toBeDefined();
		expect(updated.mcpServers["existing-server"].command).toBe("python");

		expect(updated.mcpServers["agy-ensemble"]).toBeDefined();
		expect(updated.mcpServers["agy-ensemble"].command).toBe("bun");
		expect(updated.mcpServers["agy-ensemble"].args[0]).toContain(
			"mcp-server.js",
		);
		expect(
			updated.mcpServers["agy-ensemble"].env.ENSEMBLE_DB_PATH,
		).toBeDefined();

		// Cleanup
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test("links the skill into the Antigravity skills directory idempotently", () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), "agy-ensemble-test-skill-"),
		);
		const mockProjectDir = path.join(tempDir, "repo");
		fs.mkdirSync(mockProjectDir, { recursive: true });

		const antigravityHome = path.join(tempDir, "antigravity");
		fs.mkdirSync(antigravityHome, { recursive: true });

		// First link creation
		const firstResult = setupSkillLink(mockProjectDir, antigravityHome);
		expect(firstResult.action).toBe("linked");
		expect(fs.existsSync(firstResult.skillPath)).toBe(true);

		// Second link invocation is idempotent
		const secondResult = setupSkillLink(mockProjectDir, antigravityHome);
		expect(secondResult.action).toBe("exists");

		// Cleanup
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test("unregisters agy-ensemble from mcp.json and removes skill symlink cleanly", () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), "agy-ensemble-test-unreg-"),
		);
		const mockProjectDir = path.join(tempDir, "repo");
		fs.mkdirSync(mockProjectDir, { recursive: true });

		const antigravityHome = path.join(tempDir, "antigravity");
		fs.mkdirSync(antigravityHome, { recursive: true });

		// Register both
		registerMcpServer(mockProjectDir, antigravityHome, { runtime: "bun" });
		setupSkillLink(mockProjectDir, antigravityHome);

		const unregResult = unregisterMcpServer(antigravityHome);
		expect(unregResult.removed).toBe(true);

		const mcpJson = JSON.parse(
			fs.readFileSync(path.join(antigravityHome, "mcp.json"), "utf-8"),
		);
		expect(mcpJson.mcpServers["agy-ensemble"]).toBeUndefined();

		const skillPath = path.join(antigravityHome, "skills", "agy-ensemble");
		expect(fs.existsSync(skillPath)).toBe(false);

		// Cleanup
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test("checks team status from SQLite database or reports empty baseline", () => {
		const tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), "agy-ensemble-test-status-"),
		);

		const statusNoDb = checkTeamStatus(tempDir);
		expect(statusNoDb.dbExists).toBe(false);
		expect(statusNoDb.teamCount).toBe(0);

		// Cleanup
		fs.rmSync(tempDir, { recursive: true, force: true });
	});
});
