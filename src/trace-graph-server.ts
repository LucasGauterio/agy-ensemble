import type { Database } from "./db"

interface TraceNodeRow {
  id: string
  team_id: string
  parent_id: string | null
  zoom_level: number
  node_kind: string
  label: string
  agent_name: string | null
  si_id: string | null
  status: string
  est_cost_usd: number
  actual_cost_usd: number
  est_duration_ms: number
  actual_duration_ms: number
  input_tokens: number
  output_tokens: number
  payload_json: string | null
  time_started: number
  time_completed: number | null
}

/**
 * Build the 3-level Semantic Zoom DAG payload (Level 1: Macro Pipeline, Level 2: Meso SI DAG, Level 3: Micro Tool Spans)
 * supporting optional Time-Travel Scrub Bar filtering via maxTimestampMs.
 */
export function buildSemanticZoomGraphPayload(
  db: Database,
  input: { teamId: string; zoomLevel: 1 | 2 | 3; maxTimestampMs?: number },
): {
  zoomLevel: 1 | 2 | 3
  nodes: Array<{
    id: string
    label: string
    nodeKind: string
    status: string
    siId: string | null
    agentName: string | null
    estCostUsd: number
    actualCostUsd: number
    estDurationMs: number
    actualDurationMs: number
  }>
  edges: Array<{ id: string; sourceId: string; targetId: string; edgeKind: string }>
} {
  const nodesRaw = db
    .query("SELECT * FROM trace_nodes WHERE team_id = ? AND zoom_level = ? ORDER BY time_started ASC")
    .all(input.teamId, input.zoomLevel) as TraceNodeRow[]

  const filtered =
    typeof input.maxTimestampMs === "number"
      ? nodesRaw.filter((n) => n.time_started <= (input.maxTimestampMs ?? Number.MAX_SAFE_INTEGER))
      : nodesRaw

  const edgesRaw = db
    .query("SELECT * FROM trace_edges WHERE team_id = ?")
    .all(input.teamId) as Array<{
    id: string
    source_id: string
    target_id: string
    edge_kind: string
  }>

  return {
    zoomLevel: input.zoomLevel,
    nodes: filtered.map((n) => ({
      id: n.id,
      label: n.label,
      nodeKind: n.node_kind,
      status: n.status,
      siId: n.si_id,
      agentName: n.agent_name,
      estCostUsd: n.est_cost_usd,
      actualCostUsd: n.actual_cost_usd,
      estDurationMs: n.est_duration_ms,
      actualDurationMs: n.actual_duration_ms,
    })),
    edges: edgesRaw.map((e) => ({
      id: e.id,
      sourceId: e.source_id,
      targetId: e.target_id,
      edgeKind: e.edge_kind,
    })),
  }
}

/**
 * Retrieve the 4-tab Inspector Drawer payload for any clicked node in the Trace Graph UI.
 */
export function getInspectorDrawerData(
  db: Database,
  spanId: string,
): {
  spanId: string
  label: string
  status: string
  tabs: string[]
  finops: {
    estCostUsd: number
    actualCostUsd: number
    estDurationMs: number
    actualDurationMs: number
    inputTokens: number
    outputTokens: number
  }
} {
  const row = db
    .query("SELECT * FROM trace_nodes WHERE id = ?")
    .get(spanId) as TraceNodeRow | undefined

  if (!row) throw new Error(`Trace span not found: ${spanId}`)

  return {
    spanId: row.id,
    label: row.label,
    status: row.status,
    tabs: [
      "Prompt & Context",
      "Diff & Files",
      "Tests & Quality Gate",
      "Logs & Telemetry",
    ],
    finops: {
      estCostUsd: row.est_cost_usd,
      actualCostUsd: row.actual_cost_usd,
      estDurationMs: row.est_duration_ms,
      actualDurationMs: row.actual_duration_ms,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
    },
  }
}

/**
 * Format a Server-Sent Event (SSE) frame for GET /api/trace/stream.
 */
export function formatSseTraceEvent(eventName: string, payload: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`
}
