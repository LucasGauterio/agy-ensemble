#!/usr/bin/env bun
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
	PACKAGE_ROOT_DIR,
	ensureEnsembleSource,
	findBunExecutable,
	getAntigravityHome,
	getDefaultEnsembleHome,
	installIntoProject,
	parseCliArgs,
	printInstallSummary,
	printInstallerHelp,
	uninstallFromProject,
} from "../scripts/installer-core.mjs";

function isInsideEnsembleRepo(cwd) {
	const pkgPath = path.join(cwd, "package.json");
	if (!fs.existsSync(pkgPath)) return false;
	try {
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
		return pkg?.name === "agy-ensemble";
	} catch {
		return false;
	}
}

function forwardToRunner(rawArgs, repoDir) {
	const bunBin = findBunExecutable(repoDir);
	const runnerTs = path.join(repoDir, "scripts", "runner.ts");
	if (!bunBin) {
		throw new Error(
			"Bun runtime is required for this subcommand. Install Bun (https://bun.sh) or run npm install in ~/.agy-ensemble.",
		);
	}
	const needsShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(bunBin);
	execFileSync(bunBin, ["run", runnerTs, ...rawArgs], {
		cwd: repoDir,
		stdio: "inherit",
		shell: needsShell,
		env: process.env,
	});
}

async function main() {
	const rawArgs = process.argv.slice(2);
	const cwd = process.cwd();
	const parsed = parseCliArgs(rawArgs, { defaultCommand: "install" });

	// If run from inside agy-ensemble repo itself with zero arguments and no install flags, show help
	if (
		rawArgs.length === 0 &&
		isInsideEnsembleRepo(cwd) &&
		!parsed.explicitCommand
	) {
		printInstallerHelp();
		return;
	}

	switch (parsed.command) {
		case "help": {
			printInstallerHelp();
			break;
		}

		case "install": {
			const res = installIntoProject({
				targetDir: parsed.targetDir ?? cwd,
				ensembleHome: parsed.ensembleHome,
				sourceDir: parsed.sourceDir,
				antigravityDir: parsed.antigravityDir,
				runtime: parsed.runtime,
				withTemplates: parsed.withTemplates,
				localMcp: parsed.localMcp,
				noGlobal: parsed.noGlobal,
				globalPlugin: parsed.globalPlugin,
				noUpdate: parsed.noUpdate,
				force: parsed.force,
				dryRun: parsed.dryRun,
			});
			printInstallSummary(res, parsed.dryRun);
			break;
		}

		case "uninstall": {
			const res = uninstallFromProject({
				targetDir: parsed.targetDir ?? cwd,
				antigravityDir: parsed.antigravityDir,
				global: parsed.global,
				dryRun: parsed.dryRun,
			});
			if (res.uninstalled) {
				console.log(
					`[agy-ensemble] Removed project integration from ${res.targetDir}:`,
				);
				for (const item of res.removed) {
					console.log(`  - ${item}`);
				}
			} else {
				console.log(
					`[agy-ensemble] No agy-ensemble integration found in ${res.targetDir}.`,
				);
			}
			break;
		}

		case "run": {
			const resolved = parsed.sourceDir
				? { sourceDir: path.resolve(parsed.sourceDir) }
				: fs.existsSync(path.join(PACKAGE_ROOT_DIR, "dist", "mcp-server.js"))
					? { sourceDir: PACKAGE_ROOT_DIR }
					: ensureEnsembleSource({
							ensembleHome: parsed.ensembleHome,
							noUpdate: parsed.noUpdate,
						});
			const mcpScript = path.join(resolved.sourceDir, "dist", "mcp-server.js");
			const runtimeBin =
				findBunExecutable(resolved.sourceDir) ?? process.execPath;
			const child = spawn(runtimeBin, [mcpScript], {
				stdio: "inherit",
				env: {
					...process.env,
					ENSEMBLE_DB_PATH: process.env.ENSEMBLE_DB_PATH || ".ensemble/team.db",
				},
			});
			child.on("exit", (code) => process.exit(code ?? 0));
			break;
		}

		case "status": {
			const targetDir = path.resolve(parsed.targetDir ?? cwd);
			const ensembleHome = getDefaultEnsembleHome(parsed.ensembleHome);
			const antigravityHome = getAntigravityHome(parsed.antigravityDir);
			const projectPluginPath = path.join(
				targetDir,
				".agents",
				"plugins",
				"agy-ensemble",
			);
			const dbPath = path.join(targetDir, ".ensemble", "team.db");
			let pluginInstalled = false;
			try {
				fs.lstatSync(projectPluginPath);
				pluginInstalled = true;
			} catch {
				pluginInstalled = false;
			}
			console.log("\n--- agy-ensemble Project & System Status ---");
			console.log(`Target Project:    ${targetDir}`);
			console.log(`Project Plugin:    ${pluginInstalled ? "YES" : "NO"}`);
			console.log(`Project DB (.db):  ${fs.existsSync(dbPath) ? "YES" : "NO"}`);
			console.log(
				`Global Repo:       ${ensembleHome} (${fs.existsSync(ensembleHome) ? "present" : "not cloned"})`,
			);
			console.log(`Antigravity Home:  ${antigravityHome}\n`);
			break;
		}

		case "setup":
		case "trace":
		case "verify": {
			const repoDir = isInsideEnsembleRepo(cwd)
				? cwd
				: fs.existsSync(path.join(PACKAGE_ROOT_DIR, "scripts", "runner.ts"))
					? PACKAGE_ROOT_DIR
					: getDefaultEnsembleHome(parsed.ensembleHome);
			forwardToRunner(rawArgs, repoDir);
			break;
		}
	}
}

main().catch((err) => {
	console.error(
		"[agy-ensemble] Error:",
		err instanceof Error ? err.message : String(err),
	);
	process.exit(1);
});

