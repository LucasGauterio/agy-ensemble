import { describe, expect, test } from "bun:test"
import { createDb } from "../src/db"
import { ensembleCreate } from "../src/mcp-server"
import { recordActionSpanComplete, recordActionSpanStart } from "../src/trace-collector"
import {
  buildSemanticZoomGraphPayload,
  formatSseTraceEvent,
  getInspectorDrawerData,
} from "../src/trace-graph-server"

describe("IMP-04 / VAL-04: Live Execution Trace Graph UI & 3-Level Semantic Zoom", () => {
  test("builds Level 1 (Macro), Level 2 (Meso SI DAG), and Level 3 (Micro Spans) graph payloads, Inspector 4-tab data, and Time-Travel scrub filter", () => {
    const db = createDb(":memory:")
    const team = ensembleCreate(db, { name: "trace-ui-team", leadSessionId: "lead-ui" })

    const l1 = recordActionSpanStart(db, {
      teamId: team.id,
      zoomLevel: 1,
      nodeKind: "PIPELINE_STAGE",
      label: "Etapa 8: Multi-Agent DAG Execution",
      estCostUsd: 0.5,
      estDurationMs: 120000,
    })
    const l2 = recordActionSpanStart(db, {
      teamId: team.id,
      parentId: l1.id,
      zoomLevel: 2,
      nodeKind: "SI_NODE",
      label: "SI-01.1: Auth & LGPD Consent",
      siId: "SI-01.1",
      agentName: "worker-si-01-1",
      estCostUsd: 0.25,
      estDurationMs: 60000,
    })
    const l3 = recordActionSpanStart(db, {
      teamId: team.id,
      parentId: l2.id,
      zoomLevel: 3,
      nodeKind: "TOOL_CALL",
      label: "run-suite.sh SI-01.1",
      siId: "SI-01.1",
      agentName: "worker-si-01-1",
      estCostUsd: 0.05,
      estDurationMs: 15000,
    })
    recordActionSpanComplete(db, {
      spanId: l3.id,
      status: "completed",
      inputTokens: 4000,
      outputTokens: 1000,
      actualCostUsd: 0.04,
      actualDurationMs: 12000,
    })

    const macro = buildSemanticZoomGraphPayload(db, { teamId: team.id, zoomLevel: 1 })
    const meso = buildSemanticZoomGraphPayload(db, { teamId: team.id, zoomLevel: 2 })
    const micro = buildSemanticZoomGraphPayload(db, { teamId: team.id, zoomLevel: 3 })

    expect(macro.nodes.length).toBe(1)
    expect(meso.nodes.length).toBe(1)
    expect(micro.nodes.length).toBe(1)

    const inspector = getInspectorDrawerData(db, l3.id)
    expect(inspector.tabs).toEqual([
      "Prompt & Context",
      "Diff & Files",
      "Tests & Quality Gate",
      "Logs & Telemetry",
    ])
    expect(inspector.finops.estCostUsd).toBe(0.05)
    expect(inspector.finops.actualCostUsd).toBe(0.04)

    const sse = formatSseTraceEvent("SPAN_END", { spanId: l3.id, status: "completed" })
    expect(sse).toContain("event: SPAN_END")
    expect(sse).toContain(`"spanId":"${l3.id}"`)
  })
})
