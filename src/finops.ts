import type { Database } from "./db"

interface CalibrationRow {
  category: string
  sample_count: number
  cost_multiplier: number
  duration_multiplier: number
}

/**
 * Estimate monetary cost ($) and duration (ms) for an action or SI,
 * applying learned calibration multipliers when available.
 */
export function estimateActionCostAndDuration(
  db: Database,
  input: { category: string; baseCostUsd: number; baseDurationMs: number },
): { estCostUsd: number; estDurationMs: number } {
  const row = db
    .query("SELECT * FROM cost_time_calibration WHERE category = ?")
    .get(input.category) as CalibrationRow | undefined

  const costMult = row ? row.cost_multiplier : 1.0
  const durMult = row ? row.duration_multiplier : 1.0

  return {
    estCostUsd: Number((input.baseCostUsd * costMult).toFixed(4)),
    estDurationMs: Math.round(input.baseDurationMs * durMult),
  }
}

/**
 * Calculate total estimated vs. actual monetary cost ($) and duration (ms) for a team/phase.
 */
export function calculatePhaseFinOpsSummary(
  db: Database,
  teamId: string,
): {
  totalEstCostUsd: number
  totalActualCostUsd: number
  totalEstDurationMs: number
  totalActualDurationMs: number
  costDeltaPct: number
  durationDeltaPct: number
} {
  const row = db
    .query(
      `SELECT
         COALESCE(SUM(est_cost_usd), 0) AS est_cost,
         COALESCE(SUM(actual_cost_usd), 0) AS act_cost,
         COALESCE(SUM(est_duration_ms), 0) AS est_dur,
         COALESCE(SUM(actual_duration_ms), 0) AS act_dur
       FROM trace_nodes
       WHERE team_id = ?`,
    )
    .get(teamId) as {
    est_cost: number
    act_cost: number
    est_dur: number
    act_dur: number
  }

  const costDeltaPct =
    row.est_cost > 0 ? Number((((row.act_cost - row.est_cost) / row.est_cost) * 100).toFixed(2)) : 0
  const durationDeltaPct =
    row.est_dur > 0 ? Number((((row.act_dur - row.est_dur) / row.est_dur) * 100).toFixed(2)) : 0

  return {
    totalEstCostUsd: Number(row.est_cost.toFixed(4)),
    totalActualCostUsd: Number(row.act_cost.toFixed(4)),
    totalEstDurationMs: row.est_dur,
    totalActualDurationMs: row.act_dur,
    costDeltaPct,
    durationDeltaPct,
  }
}

/**
 * Update EMA calibration multipliers in cost_time_calibration during Stage 10 Retrospective.
 */
export function updateCostTimeCalibration(
  db: Database,
  input: {
    category: string
    estCostUsd: number
    actualCostUsd: number
    estDurationMs: number
    actualDurationMs: number
  },
): { costMultiplier: number; durationMultiplier: number; sampleCount: number } {
  const existing = db
    .query("SELECT * FROM cost_time_calibration WHERE category = ?")
    .get(input.category) as CalibrationRow | undefined

  const observedCostRatio = input.estCostUsd > 0 ? input.actualCostUsd / input.estCostUsd : 1.0
  const observedDurRatio =
    input.estDurationMs > 0 ? input.actualDurationMs / input.estDurationMs : 1.0

  const alpha = 0.5
  const prevCostMult = existing ? existing.cost_multiplier : 1.0
  const prevDurMult = existing ? existing.duration_multiplier : 1.0
  const sampleCount = (existing?.sample_count ?? 0) + 1

  const costMultiplier = Number(
    (prevCostMult * (1 - alpha) + observedCostRatio * alpha).toFixed(4),
  )
  const durationMultiplier = Number(
    (prevDurMult * (1 - alpha) + observedDurRatio * alpha).toFixed(4),
  )

  db.run(
    `INSERT INTO cost_time_calibration (category, sample_count, cost_multiplier, duration_multiplier, time_updated)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(category) DO UPDATE SET
       sample_count = excluded.sample_count,
       cost_multiplier = excluded.cost_multiplier,
       duration_multiplier = excluded.duration_multiplier,
       time_updated = excluded.time_updated`,
    [input.category, sampleCount, costMultiplier, durationMultiplier, Date.now()],
  )

  return { costMultiplier, durationMultiplier, sampleCount }
}
