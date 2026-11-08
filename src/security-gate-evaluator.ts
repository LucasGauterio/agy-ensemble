/**
 * Evaluate the 3-Layer Offensive & Defensive Security Gate:
 * 1. SAST (Semgrep + Sonar SAST + custom LGPD rules) & SCA (Trivy)
 * 2. DAST (OWASP ZAP + Nuclei against live containerized app)
 * 3. Red-Team PenTests (worker-pentest-nn testing BOLA/IDOR, BFLA/Mass Assignment, Race Conditions, and LGPD post-anonymization residue)
 */
export function evaluateOffensiveDefensiveSecurityGate(input: {
  sastSemgrepErrors: number
  scaTrivyCriticalHigh: number
  dastZapHighMediumAlerts: number
  pentestReport: {
    workerAgent: string
    bolaIdorExploited: boolean
    bflaMassAssignmentExploited: boolean
    raceConditionDoubleSpendExploited: boolean
    lgpdAnonymizationResidueFound: boolean
  }
}): { passed: boolean; remediationRequired: boolean; blockingFindings: string[] } {
  const blockingFindings: string[] = []

  if (input.sastSemgrepErrors > 0) {
    blockingFindings.push(`SAST Semgrep reported ${input.sastSemgrepErrors} blocking error(s).`)
  }
  if (input.scaTrivyCriticalHigh > 0) {
    blockingFindings.push(`SCA Trivy reported ${input.scaTrivyCriticalHigh} CRITICAL/HIGH vulnerability(ies).`)
  }
  if (input.dastZapHighMediumAlerts > 0) {
    blockingFindings.push(`DAST OWASP ZAP/Nuclei reported ${input.dastZapHighMediumAlerts} HIGH/MEDIUM alert(s).`)
  }
  if (input.pentestReport.bolaIdorExploited) {
    blockingFindings.push(`PenTest (${input.pentestReport.workerAgent}): BOLA/IDOR cross-tenant exploit succeeded.`)
  }
  if (input.pentestReport.bflaMassAssignmentExploited) {
    blockingFindings.push(`PenTest (${input.pentestReport.workerAgent}): BFLA or Mass Assignment exploit succeeded.`)
  }
  if (input.pentestReport.raceConditionDoubleSpendExploited) {
    blockingFindings.push(`PenTest (${input.pentestReport.workerAgent}): Concurrent Race Condition / TOCTOU exploit succeeded.`)
  }
  if (input.pentestReport.lgpdAnonymizationResidueFound) {
    blockingFindings.push(`PenTest (${input.pentestReport.workerAgent}): LGPD Art. 18 violation — PII residue found in DB/Cache/Logs after anonymization.`)
  }

  return {
    passed: blockingFindings.length === 0,
    remediationRequired: blockingFindings.length > 0,
    blockingFindings,
  }
}
