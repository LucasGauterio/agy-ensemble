import { describe, expect, test } from "bun:test"
import { createDb } from "../src/db"
import {
  ensembleBroadcast,
  ensembleClaim,
  ensembleCleanup,
  ensembleCreate,
  ensembleImportPhasePlan,
  ensembleMerge,
  ensembleMessage,
  ensembleResults,
  ensembleShutdown,
  ensembleSpawn,
  ensembleStatus,
  ensembleTasksAdd,
  ensembleTasksComplete,
  ensembleTasksList,
  ensembleView,
} from "../src/mcp-server"

describe("IMP-01 / VAL-01: agy-ensemble SQLite WAL & 15 MCP Tools", () => {
  test("creates team with strict delegate: true by default and registers all expanded tables", () => {
    const db = createDb(":memory:")
    const team = ensembleCreate(db, {
      name: "phase-01-core",
      leadSessionId: "lead-sess-1",
      projectPath: "E:/Projects/demo",
    })

    expect(team.name).toBe("phase-01-core")
    expect(team.delegate).toBe(true)

    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>
    const tableNames = tables.map((t) => t.name)

    expect(tableNames).toContain("team")
    expect(tableNames).toContain("team_member")
    expect(tableNames).toContain("team_task")
    expect(tableNames).toContain("team_message")
    expect(tableNames).toContain("trace_nodes")
    expect(tableNames).toContain("trace_edges")
    expect(tableNames).toContain("team_learnings")
    expect(tableNames).toContain("cost_time_calibration")
  })

  test("imports phase plan DAG, enforces File-Touch Disjointness across parallel SIs, and unblocks DAG tasks on completion", () => {
    const db = createDb(":memory:")
    const team = ensembleCreate(db, {
      name: "phase-01-dag",
      leadSessionId: "lead-sess-1",
    })

    const imported = ensembleImportPhasePlan(db, {
      teamId: team.id,
      phaseId: "Phase-01",
      steps: [
        {
          siId: "SI-01.0.0",
          title: "Infra & Vault Setup",
          dependsOn: [],
          filesTouched: ["docker-compose.infra.yml", "src/config/vault.ts"],
          estCostUsd: 0.12,
          estDurationMs: 45000,
        },
        {
          siId: "SI-01.1",
          title: "Auth Service",
          dependsOn: ["SI-01.0.0"],
          filesTouched: ["src/auth/auth.service.ts"],
          estCostUsd: 0.25,
          estDurationMs: 90000,
        },
        {
          siId: "SI-01.2",
          title: "User Profile Service",
          dependsOn: ["SI-01.0.0"],
          filesTouched: ["src/users/user.service.ts"],
          estCostUsd: 0.22,
          estDurationMs: 80000,
        },
      ],
    })

    expect(imported.tasksCreated).toBe(3)
    const initialTasks = ensembleTasksList(db, { teamId: team.id })
    const si0 = initialTasks.find((t) => t.siId === "SI-01.0.0")
    const si1 = initialTasks.find((t) => t.siId === "SI-01.1")
    const si2 = initialTasks.find((t) => t.siId === "SI-01.2")

    expect(si0?.status).toBe("pending")
    expect(si1?.status).toBe("blocked")
    expect(si2?.status).toBe("blocked")

    // Completing SI-01.0.0 automatically unblocks SI-01.1 and SI-01.2
    const completion = ensembleTasksComplete(db, {
      teamId: team.id,
      taskId: si0?.id ?? "",
      actualCostUsd: 0.11,
      actualDurationMs: 42000,
    })
    expect(completion.unblockedTaskIds.length).toBe(2)

    const afterWave0 = ensembleTasksList(db, { teamId: team.id })
    expect(afterWave0.find((t) => t.siId === "SI-01.1")?.status).toBe("pending")
    expect(afterWave0.find((t) => t.siId === "SI-01.2")?.status).toBe("pending")
  })

  test("rejects phase plan import when two parallel SIs touch the same file without dependency edge (Error path)", () => {
    const db = createDb(":memory:")
    const team = ensembleCreate(db, {
      name: "phase-01-conflict",
      leadSessionId: "lead-sess-2",
    })

    expect(() =>
      ensembleImportPhasePlan(db, {
        teamId: team.id,
        phaseId: "Phase-01",
        steps: [
          {
            siId: "SI-01.1",
            title: "Edit Shared File A",
            dependsOn: [],
            filesTouched: ["src/shared/index.ts"],
            estCostUsd: 0.1,
            estDurationMs: 30000,
          },
          {
            siId: "SI-01.2",
            title: "Concurrent Edit Shared File A",
            dependsOn: [],
            filesTouched: ["src/shared/index.ts"],
            estCostUsd: 0.1,
            estDurationMs: 30000,
          },
        ],
      }),
    ).toThrow(/File-Touch Disjointness violation/)
  })

  test("spawns fresh teammate per SI, preserves branch before shutdown, and merges cleanly", () => {
    const db = createDb(":memory:")
    const team = ensembleCreate(db, {
      name: "phase-01-workers",
      leadSessionId: "lead-sess-3",
    })

    const added = ensembleTasksAdd(db, {
      teamId: team.id,
      siId: "SI-01.1",
      content: "Implement SI-01.1",
      priority: "high",
      estCostUsd: 0.18,
      estDurationMs: 60000,
    })

    const spawned = ensembleSpawn(db, {
      teamId: team.id,
      callerSessionId: "lead-sess-3",
      name: "worker-si-01-1",
      siId: "SI-01.1",
      agent: "worker-teammate",
      prompt: "Execute SI-01.1",
    })
    expect(spawned.workspaceMode).toBe("share")
    expect(spawned.worktreeBranch).toBe("ensemble-phase-01-workers-worker-si-01-1")

    const claimed = ensembleClaim(db, {
      teamId: team.id,
      taskId: added.id,
      memberName: "worker-si-01-1",
    })
    expect(claimed.status).toBe("in_progress")

    const msg = ensembleMessage(db, {
      teamId: team.id,
      fromName: "worker-si-01-1",
      toName: "lead",
      content: "<si-report>Completed SI-01.1</si-report>",
    })
    expect(msg.id).toBeTruthy()

    const broadcast = ensembleBroadcast(db, {
      teamId: team.id,
      fromName: "lead",
      content: "Wave 1 status check",
    })
    expect(broadcast.recipientCount).toBe(1)

    const results = ensembleResults(db, {
      teamId: team.id,
      messageId: msg.id,
    })
    expect(results.content).toContain("<si-report>")

    // Shutdown MUST preserve branch before aborting
    const shutdown = ensembleShutdown(db, {
      teamId: team.id,
      callerSessionId: "lead-sess-3",
      memberName: "worker-si-01-1",
    })
    expect(shutdown.preservedBranch).toBe("ensemble/preserved/phase-01-workers/worker-si-01-1")
    expect(shutdown.status).toBe("shutdown")

    // Merge requires preserved branch and shutdown status
    const merged = ensembleMerge(db, {
      teamId: team.id,
      callerSessionId: "lead-sess-3",
      memberName: "worker-si-01-1",
      targetBranch: "feature/phase-01-workers",
    })
    expect(merged.merged).toBe(true)
    expect(merged.sourceRef).toBe("ensemble/preserved/phase-01-workers/worker-si-01-1")

    const status = ensembleStatus(db, { teamId: team.id })
    expect(status.members.length).toBe(1)

    const view = ensembleView(db, { teamId: team.id, memberName: "worker-si-01-1" })
    expect(view.sessionId).toBe(spawned.sessionId)

    const cleanup = ensembleCleanup(db, {
      teamId: team.id,
      callerSessionId: "lead-sess-3",
    })
    expect(cleanup.teamStatus).toBe("archived")
  })
})
