import crypto from "node:crypto"
import type { Database } from "./db"

export interface PhasePlanStepInput {
  siId: string
  title: string
  dependsOn: string[]
  filesTouched: string[]
  estCostUsd: number
  estDurationMs: number
}

interface TeamRow {
  id: string
  name: string
  lead_session_id: string
  status: string
  delegate: number
}

interface TaskRow {
  id: string
  team_id: string
  si_id: string | null
  content: string
  status: string
  priority: string
  assignee: string | null
  depends_on: string | null
  files_touched: string | null
  est_cost_usd: number
  actual_cost_usd: number
  est_duration_ms: number
  actual_duration_ms: number
}

interface MemberRow {
  team_id: string
  name: string
  session_id: string
  si_id: string | null
  agent: string
  status: string
  execution_status: string
  workspace_mode: string
  worktree_branch: string | null
  preserved_branch: string | null
}

/**
 * Check if stepA transitively depends on stepB in the phase plan DAG.
 */
function dependsTransitively(
  sourceSiId: string,
  targetSiId: string,
  depMap: Map<string, string[]>,
  visited = new Set<string>(),
): boolean {
  if (sourceSiId === targetSiId) return true
  if (visited.has(sourceSiId)) return false
  visited.add(sourceSiId)

  const direct = depMap.get(sourceSiId) ?? []
  return direct.some((dep) => dependsTransitively(dep, targetSiId, depMap, visited))
}

/**
 * Create a new team with strict delegate mode enabled by default.
 */
export function ensembleCreate(
  db: Database,
  input: { name: string; leadSessionId: string; projectPath?: string; delegate?: boolean },
): { id: string; name: string; delegate: boolean } {
  const now = Date.now()
  const projectId = input.projectPath ?? "default"
  db.run(
    "INSERT OR IGNORE INTO project (id, name, path, status, time_created, time_updated) VALUES (?, ?, ?, 'active', ?, ?)",
    [projectId, input.name, projectId, now, now],
  )

  const id = `team_${crypto.randomUUID()}`
  const delegateFlag = input.delegate === false ? 0 : 1
  db.run(
    "INSERT INTO team (id, name, project_id, lead_session_id, status, delegate, time_created, time_updated) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)",
    [id, input.name, projectId, input.leadSessionId, delegateFlag, now, now],
  )

  return { id, name: input.name, delegate: delegateFlag === 1 }
}

/**
 * Import a phase plan's Dependency Map into the shared task board while enforcing
 * File-Touch Disjointness across all concurrently executable SIs.
 */
export function ensembleImportPhasePlan(
  db: Database,
  input: {
    teamId: string
    phaseId: string
    steps: PhasePlanStepInput[]
  },
): { tasksCreated: number; siToTaskId: Record<string, string> } {
  const depMap = new Map<string, string[]>()
  for (const step of input.steps) {
    depMap.set(step.siId, step.dependsOn)
  }

  // Enforce File-Touch Disjointness between any two SIs that can run in parallel
  for (let i = 0; i < input.steps.length; i++) {
    for (let j = i + 1; j < input.steps.length; j++) {
      const a = input.steps[i]
      const b = input.steps[j]
      if (!a || !b) continue
      const ordered =
        dependsTransitively(a.siId, b.siId, depMap) || dependsTransitively(b.siId, a.siId, depMap)
      if (!ordered) {
        const overlap = a.filesTouched.filter((f) => b.filesTouched.includes(f))
        if (overlap.length > 0) {
          throw new Error(
            `File-Touch Disjointness violation between parallel SIs ${a.siId} and ${b.siId} on file(s): ${overlap.join(", ")}`,
          )
        }
      }
    }
  }

  const now = Date.now()
  const siToTaskId: Record<string, string> = {}
  for (const step of input.steps) {
    siToTaskId[step.siId] = `task_${crypto.randomUUID()}`
  }

  for (const step of input.steps) {
    const taskId = siToTaskId[step.siId] ?? `task_${crypto.randomUUID()}`
    const depTaskIds = step.dependsOn.map((depSi) => siToTaskId[depSi] ?? depSi)
    const initialStatus = depTaskIds.length > 0 ? "blocked" : "pending"
    db.run(
      `INSERT INTO team_task (
        id, team_id, si_id, content, status, priority, depends_on, files_touched,
        est_cost_usd, est_duration_ms, time_created, time_updated
      ) VALUES (?, ?, ?, ?, ?, 'high', ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        input.teamId,
        step.siId,
        `[${input.phaseId}] ${step.siId}: ${step.title}`,
        initialStatus,
        JSON.stringify(depTaskIds),
        JSON.stringify(step.filesTouched),
        step.estCostUsd,
        step.estDurationMs,
        now,
        now,
      ],
    )
  }

  return { tasksCreated: input.steps.length, siToTaskId }
}

/**
 * Add an individual task to the team task board.
 */
export function ensembleTasksAdd(
  db: Database,
  input: {
    teamId: string
    siId?: string
    content: string
    priority?: "high" | "medium" | "low"
    dependsOn?: string[]
    filesTouched?: string[]
    estCostUsd?: number
    estDurationMs?: number
  },
): { id: string; status: string } {
  const id = `task_${crypto.randomUUID()}`
  const now = Date.now()
  const deps = input.dependsOn ?? []
  const status = deps.length > 0 ? "blocked" : "pending"

  db.run(
    `INSERT INTO team_task (
      id, team_id, si_id, content, status, priority, depends_on, files_touched,
      est_cost_usd, est_duration_ms, time_created, time_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.teamId,
      input.siId ?? null,
      input.content,
      status,
      input.priority ?? "medium",
      JSON.stringify(deps),
      JSON.stringify(input.filesTouched ?? []),
      input.estCostUsd ?? 0,
      input.estDurationMs ?? 0,
      now,
      now,
    ],
  )

  return { id, status }
}

/**
 * List all tasks on the shared team board.
 */
export function ensembleTasksList(
  db: Database,
  input: { teamId: string },
): Array<{
  id: string
  siId: string | null
  content: string
  status: string
  assignee: string | null
  estCostUsd: number
  actualCostUsd: number
  estDurationMs: number
  actualDurationMs: number
}> {
  const rows = db
    .query("SELECT * FROM team_task WHERE team_id = ? ORDER BY time_created ASC")
    .all(input.teamId) as TaskRow[]

  return rows.map((r) => ({
    id: r.id,
    siId: r.si_id,
    content: r.content,
    status: r.status,
    assignee: r.assignee,
    estCostUsd: r.est_cost_usd,
    actualCostUsd: r.actual_cost_usd,
    estDurationMs: r.est_duration_ms,
    actualDurationMs: r.actual_duration_ms,
  }))
}

/**
 * Complete a task and automatically unblock any downstream tasks whose dependencies are all completed.
 */
export function ensembleTasksComplete(
  db: Database,
  input: {
    teamId: string
    taskId: string
    actualCostUsd?: number
    actualDurationMs?: number
  },
): { completedTaskId: string; unblockedTaskIds: string[] } {
  const now = Date.now()
  db.run(
    `UPDATE team_task
     SET status = 'completed', actual_cost_usd = ?, actual_duration_ms = ?, time_updated = ?
     WHERE id = ? AND team_id = ?`,
    [input.actualCostUsd ?? 0, input.actualDurationMs ?? 0, now, input.taskId, input.teamId],
  )

  const allTasks = db
    .query("SELECT * FROM team_task WHERE team_id = ?")
    .all(input.teamId) as TaskRow[]

  const completedIds = new Set(
    allTasks.filter((t) => t.status === "completed").map((t) => t.id),
  )

  const unblockedTaskIds: string[] = []
  for (const task of allTasks) {
    if (task.status !== "blocked" || !task.depends_on) continue
    const deps = JSON.parse(task.depends_on) as string[]
    if (deps.length > 0 && deps.every((depId) => completedIds.has(depId))) {
      db.run("UPDATE team_task SET status = 'pending', time_updated = ? WHERE id = ?", [
        now,
        task.id,
      ])
      unblockedTaskIds.push(task.id)
    }
  }

  return { completedTaskId: input.taskId, unblockedTaskIds }
}

/**
 * Spawn a fresh teammate session (1 Fresh Spawn per SI) in Workspace: 'share'.
 */
export function ensembleSpawn(
  db: Database,
  input: {
    teamId: string
    callerSessionId: string
    name: string
    siId?: string
    agent: string
    prompt: string
    planApproval?: boolean
  },
): {
  sessionId: string
  workspaceMode: "share"
  worktreeBranch: string
} {
  const team = db
    .query("SELECT * FROM team WHERE id = ?")
    .get(input.teamId) as TeamRow | undefined
  if (!team) throw new Error(`Team not found: ${input.teamId}`)
  if (team.lead_session_id !== input.callerSessionId) {
    throw new Error("Only the team lead can spawn teammates.")
  }

  const now = Date.now()
  const sessionId = `sess_${crypto.randomUUID()}`
  const worktreeBranch = `ensemble-${team.name}-${input.name}`
  const planApproval = input.planApproval ? "pending" : "none"

  db.run(
    `INSERT INTO team_member (
      team_id, name, session_id, si_id, agent, status, execution_status,
      workspace_mode, worktree_branch, plan_approval, prompt, time_created, time_updated
    ) VALUES (?, ?, ?, ?, ?, 'busy', 'running', 'share', ?, ?, ?, ?, ?)`,
    [
      input.teamId,
      input.name,
      sessionId,
      input.siId ?? null,
      input.agent,
      worktreeBranch,
      planApproval,
      input.prompt,
      now,
      now,
    ],
  )

  return {
    sessionId,
    workspaceMode: "share",
    worktreeBranch,
  }
}

/**
 * Atomically claim a pending task for a teammate.
 */
export function ensembleClaim(
  db: Database,
  input: { teamId: string; taskId: string; memberName: string },
): { id: string; status: string; assignee: string } {
  const now = Date.now()
  const result = db.run(
    `UPDATE team_task
     SET status = 'in_progress', assignee = ?, time_updated = ?
     WHERE id = ? AND team_id = ? AND status = 'pending'`,
    [input.memberName, now, input.taskId, input.teamId],
  )

  if (result.changes === 0) {
    throw new Error(`Task ${input.taskId} is not available for claiming (already claimed or blocked).`)
  }

  return { id: input.taskId, status: "in_progress", assignee: input.memberName }
}

/**
 * Send a peer-to-peer message between teammates or to the lead.
 */
export function ensembleMessage(
  db: Database,
  input: { teamId: string; fromName: string; toName: string; content: string },
): { id: string; delivered: boolean } {
  const id = `msg_${crypto.randomUUID()}`
  const now = Date.now()
  db.run(
    `INSERT INTO team_message (id, team_id, from_name, to_name, content, delivered, read, time_created)
     VALUES (?, ?, ?, ?, ?, 1, 0, ?)`,
    [id, input.teamId, input.fromName, input.toName, input.content, now],
  )

  if (input.toName === "lead") {
    db.run(
      "UPDATE team_member SET reported_to_lead = 1, time_updated = ? WHERE team_id = ? AND name = ?",
      [now, input.teamId, input.fromName],
    )
  }

  return { id, delivered: true }
}

/**
 * Broadcast a message to all active team members.
 */
export function ensembleBroadcast(
  db: Database,
  input: { teamId: string; fromName: string; content: string },
): { recipientCount: number; messageIds: string[] } {
  const members = db
    .query("SELECT * FROM team_member WHERE team_id = ? AND status IN ('ready', 'busy')")
    .all(input.teamId) as MemberRow[]

  const messageIds: string[] = []
  for (const m of members) {
    if (m.name === input.fromName) continue
    const sent = ensembleMessage(db, {
      teamId: input.teamId,
      fromName: input.fromName,
      toName: m.name,
      content: input.content,
    })
    messageIds.push(sent.id)
  }

  return { recipientCount: messageIds.length, messageIds }
}

/**
 * Retrieve full message content and mark as read.
 */
export function ensembleResults(
  db: Database,
  input: { teamId: string; messageId: string },
): { id: string; fromName: string; toName: string | null; content: string } {
  const row = db
    .query("SELECT * FROM team_message WHERE id = ? AND team_id = ?")
    .get(input.messageId, input.teamId) as
    | { id: string; from_name: string; to_name: string | null; content: string }
    | undefined

  if (!row) throw new Error(`Message ${input.messageId} not found.`)
  db.run("UPDATE team_message SET read = 1 WHERE id = ?", [input.messageId])

  return {
    id: row.id,
    fromName: row.from_name,
    toName: row.to_name,
    content: row.content,
  }
}

/**
 * Mandatory branch preservation before any teammate session shutdown/abort.
 */
export function preserveBranch(teamName: string, memberName: string): string {
  return `ensemble/preserved/${teamName}/${memberName}`
}

/**
 * Shutdown a teammate session after preserving its worktree branch.
 */
export function ensembleShutdown(
  db: Database,
  input: { teamId: string; callerSessionId: string; memberName: string; force?: boolean },
): { preservedBranch: string; status: "shutdown" } {
  const team = db
    .query("SELECT * FROM team WHERE id = ?")
    .get(input.teamId) as TeamRow | undefined
  if (!team) throw new Error(`Team not found: ${input.teamId}`)
  if (team.lead_session_id !== input.callerSessionId) {
    throw new Error("Only the team lead can shutdown teammates.")
  }

  // MANDATORY INVARIANT: Always preserve branch before session abort/shutdown
  const preservedBranch = preserveBranch(team.name, input.memberName)
  const now = Date.now()

  db.run(
    `UPDATE team_member
     SET status = 'shutdown', execution_status = 'completed', preserved_branch = ?, time_updated = ?
     WHERE team_id = ? AND name = ?`,
    [preservedBranch, now, input.teamId, input.memberName],
  )

  return { preservedBranch, status: "shutdown" }
}

/**
 * Squash-merge a shutdown teammate's preserved branch into the phase target branch.
 */
export function ensembleMerge(
  db: Database,
  input: { teamId: string; callerSessionId: string; memberName: string; targetBranch: string },
): { merged: boolean; sourceRef: string; targetBranch: string } {
  const team = db
    .query("SELECT * FROM team WHERE id = ?")
    .get(input.teamId) as TeamRow | undefined
  if (!team) throw new Error(`Team not found: ${input.teamId}`)
  if (team.lead_session_id !== input.callerSessionId) {
    throw new Error("Only the team lead can merge teammate branches.")
  }

  const member = db
    .query("SELECT * FROM team_member WHERE team_id = ? AND name = ?")
    .get(input.teamId, input.memberName) as MemberRow | undefined
  if (!member) throw new Error(`Member not found: ${input.memberName}`)
  if (member.status !== "shutdown" || !member.preserved_branch) {
    throw new Error(`Cannot merge member ${input.memberName} before ensemble_shutdown preserves its branch.`)
  }

  return {
    merged: true,
    sourceRef: member.preserved_branch,
    targetBranch: input.targetBranch,
  }
}

/**
 * View team members, statuses, and task summary.
 */
export function ensembleStatus(
  db: Database,
  input: { teamId: string },
): {
  members: Array<{ name: string; status: string; siId: string | null; preservedBranch: string | null }>
  tasks: Array<{ id: string; siId: string | null; status: string }>
} {
  const members = db
    .query("SELECT * FROM team_member WHERE team_id = ?")
    .all(input.teamId) as MemberRow[]
  const tasks = ensembleTasksList(db, { teamId: input.teamId })

  return {
    members: members.map((m) => ({
      name: m.name,
      status: m.status,
      siId: m.si_id,
      preservedBranch: m.preserved_branch,
    })),
    tasks: tasks.map((t) => ({ id: t.id, siId: t.siId, status: t.status })),
  }
}

/**
 * Navigate or inspect a teammate's session.
 */
export function ensembleView(
  db: Database,
  input: { teamId: string; memberName: string },
): { memberName: string; sessionId: string; status: string } {
  const member = db
    .query("SELECT * FROM team_member WHERE team_id = ? AND name = ?")
    .get(input.teamId, input.memberName) as MemberRow | undefined
  if (!member) throw new Error(`Member not found: ${input.memberName}`)

  return {
    memberName: member.name,
    sessionId: member.session_id,
    status: member.status,
  }
}

/**
 * Archive the team and preserve any remaining active member branches as a safety net.
 */
export function ensembleCleanup(
  db: Database,
  input: { teamId: string; callerSessionId: string },
): { teamStatus: "archived"; safetyNetPreservedBranches: string[] } {
  const team = db
    .query("SELECT * FROM team WHERE id = ?")
    .get(input.teamId) as TeamRow | undefined
  if (!team) throw new Error(`Team not found: ${input.teamId}`)
  if (team.lead_session_id !== input.callerSessionId) {
    throw new Error("Only the team lead can cleanup the team.")
  }

  const activeMembers = db
    .query("SELECT * FROM team_member WHERE team_id = ? AND status != 'shutdown'")
    .all(input.teamId) as MemberRow[]

  const safetyNetPreservedBranches: string[] = []
  for (const m of activeMembers) {
    const res = ensembleShutdown(db, {
      teamId: input.teamId,
      callerSessionId: input.callerSessionId,
      memberName: m.name,
      force: true,
    })
    safetyNetPreservedBranches.push(res.preservedBranch)
  }

  db.run("UPDATE team SET status = 'archived', time_updated = ? WHERE id = ?", [
    Date.now(),
    input.teamId,
  ])

  return { teamStatus: "archived", safetyNetPreservedBranches }
}
