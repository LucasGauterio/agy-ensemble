/**
 * Generate the Executive Planning Report presented to the user at the transition from Stage 7.5 to Stage 8.
 */
export function generatePreExecutionExecutiveReport(input: {
  phaseId: string
  consolidatedGoal: string
  volumetryTiers: { seedUsd: number; growthUsd: number; scaleUsd: number }
  waves: Array<{ waveIndex: number; siIds: string[] }>
  totalEstCostUsd: number
  totalEstDurationMs: number
  traceGraphUri: string
}): string {
  const waveLines = input.waves
    .map((w) => `- **Onda ${w.waveIndex}:** ${w.siIds.join(", ")}`)
    .join("\n")

  return [
    "## Relatório Executivo de Planejamento (Transição Etapa 7.5 → Etapa 8)",
    "",
    `- **Fase:** ${input.phaseId}`,
    `- **Objetivo Consolidado:** ${input.consolidatedGoal}`,
    `- **Estimativa Cloud TCO (3 Faixas):** Seed $${input.volumetryTiers.seedUsd}/mês | Growth $${input.volumetryTiers.growthUsd}/mês | Scale $${input.volumetryTiers.scaleUsd}/mês`,
    `- **Orçamento Estimado dos Agentes (Fase):** $${input.totalEstCostUsd.toFixed(2)} | Tempo Estimado: ${Math.round(input.totalEstDurationMs / 1000)}s`,
    `- **Live Execution Trace Graph UI:** ${input.traceGraphUri}`,
    "",
    "### Ondas de Execução no DAG (1 Fresh Teammate por SI em Workspace: 'share')",
    waveLines,
  ].join("\n")
}

/**
 * Enforce the strict delegate: true invariant: the Lead Maestro can never directly edit src/** or test/**.
 */
export function assertLeadZeroCodeRule(input: {
  callerRole: "lead" | "teammate"
  targetFilePath: string
}): void {
  const normalized = input.targetFilePath.replace(/\\/g, "/")
  if (
    input.callerRole === "lead" &&
    (normalized.startsWith("src/") || normalized.startsWith("test/"))
  ) {
    throw new Error(
      `Strict delegate: true violation: Lead cannot write implementation/test file ${normalized}. Spawn a dedicated SI Teammate instead.`,
    )
  }
}
