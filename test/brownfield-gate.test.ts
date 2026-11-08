import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import {
  bootstrapAndSyncBrownfieldProject,
  evaluateBrownfieldGate,
} from "../src/brownfield-gate"

describe("IMP-00 / VAL-00: Etapa 0.0 Brownfield & Codebase-Doc Sync Blocking Gate", () => {
  test("detects uninitialized brownfield repository with existing code but missing workflow artifacts and blocks new feature work", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-brownfield-"))
    const srcDir = path.join(tmpDir, "src")
    fs.mkdirSync(srcDir, { recursive: true })
    fs.writeFileSync(
      path.join(srcDir, "server.ts"),
      "export function startServer() { return 'ok' }\n",
    )

    const check = evaluateBrownfieldGate(tmpDir)
    expect(check.isBrownfield).toBe(true)
    expect(check.canStartNewWork).toBe(false)
    expect(check.missingArtifacts).toContain("AGENTS.md")
    expect(check.missingArtifacts).toContain("docs/project-plan.md")
    expect(check.missingArtifacts).toContain("docs/TRACKER.md")
    expect(check.missingArtifacts).toContain("docs/VALIDATION.md")

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test("bootstraps brownfield repository, performs reverse codebase analysis, generates retroactive planning + progress/tracker, and unlocks Etapa 1.0 with 0 drift", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-brownfield-sync-"))
    const srcDir = path.join(tmpDir, "src", "billing")
    fs.mkdirSync(srcDir, { recursive: true })
    fs.writeFileSync(
      path.join(srcDir, "invoice.service.ts"),
      "export class InvoiceService { issueInvoice(cpf: string) { return cpf } }\n",
    )

    // Before bootstrap: blocked
    expect(evaluateBrownfieldGate(tmpDir).canStartNewWork).toBe(false)

    // Execute Etapa 0.0 Brownfield Initialization + Retroactive Planning + Tracker Sync
    const syncResult = bootstrapAndSyncBrownfieldProject(tmpDir, {
      projectName: "legacy-billing-service",
    })

    expect(syncResult.initialized).toBe(true)
    expect(syncResult.scannedSourceFiles).toContain("src/billing/invoice.service.ts")
    expect(syncResult.driftCount).toBe(0)

    // Verify all mandatory workflow artifacts were created and synchronized
    const afterCheck = evaluateBrownfieldGate(tmpDir)
    expect(afterCheck.canStartNewWork).toBe(true)
    expect(afterCheck.missingArtifacts.length).toBe(0)
    expect(afterCheck.driftCount).toBe(0)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test("blocks new work when codebase has untracked source files not reflected in docs/TRACKER.md (Drift error path)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-brownfield-drift-"))
    const srcDir = path.join(tmpDir, "src")
    fs.mkdirSync(srcDir, { recursive: true })
    fs.writeFileSync(path.join(srcDir, "auth.ts"), "export const auth = true\n")

    bootstrapAndSyncBrownfieldProject(tmpDir, { projectName: "drift-demo" })
    expect(evaluateBrownfieldGate(tmpDir).canStartNewWork).toBe(true)

    // Developer adds a new file outside the workflow without updating docs/TRACKER.md
    fs.writeFileSync(path.join(srcDir, "untracked-payment.ts"), "export const pay = true\n")

    const driftedCheck = evaluateBrownfieldGate(tmpDir)
    expect(driftedCheck.canStartNewWork).toBe(false)
    expect(driftedCheck.driftCount).toBeGreaterThan(0)
    expect(driftedCheck.untrackedFiles).toContain("src/untracked-payment.ts")

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
