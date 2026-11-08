const BRAZILIAN_PII_KEYS = new Set([
  "cpf",
  "cnpj",
  "rg",
  "email",
  "phone",
  "telefone",
  "celular",
  "pix",
  "pixkey",
  "birthdate",
  "datanascimento",
  "creditcard",
  "password",
  "senha",
  "token",
  "secret",
  "authorization",
  "cookie",
])

/**
 * Validate a phase plan against Mandate NFR-0 and mandatory Brazilian LGPD compliance (SEC-OBS-LGPD-N).
 */
export function validatePhasePlanMandateNfr0AndLgpd(input: {
  handlesPersonalData: boolean
  hasLgpdRopaTable: boolean
  hasArt18ExportAndAnonymization: boolean
  hasVaultTransitFieldEncryption: boolean
  hasConsentLedgerOptIn: boolean
  hasVaultSecretPaths: boolean
  hasStructuredJsonLoggingWithBrRedaction: boolean
  hasOpenTelemetryProbes: boolean
}): { status: "clean" | "dirty"; issues: string[] } {
  const issues: string[] = []

  if (input.handlesPersonalData) {
    if (!input.hasLgpdRopaTable) {
      issues.push("SEC-OBS-LGPD-1: Missing LGPD ROPA table (Finalidade, Base Legal Art. 7/11, Minimização Art. 6, Retenção/TTL Art. 15/16).")
    }
    if (!input.hasArt18ExportAndAnonymization) {
      issues.push("SEC-OBS-LGPD-2: Missing Art. 18 LGPD Data Subject Rights (Portability export + irreversible anonymization / crypto-shredding).")
    }
    if (!input.hasVaultTransitFieldEncryption) {
      issues.push("SEC-OBS-LGPD-3: Missing AES-256-GCM Vault Transit field encryption + HMAC-SHA256 blind index for CPF/RG/sensitive PII.")
    }
    if (!input.hasConsentLedgerOptIn) {
      issues.push("SEC-OBS-LGPD-4: Missing immutable Consent Ledger with explicit opt-in (Privacy by Default).")
    }
  }

  if (!input.hasVaultSecretPaths) {
    issues.push("SEC-OBS-LGPD-5: Missing centralized Vault/Config Server paths (.env files are forbidden).")
  }
  if (!input.hasStructuredJsonLoggingWithBrRedaction) {
    issues.push("SEC-OBS-LGPD-6: Missing structured JSON logger with automatic Brazilian PII redaction ([LGPD_REDACTED]).")
  }
  if (!input.hasOpenTelemetryProbes) {
    issues.push("SEC-OBS-LGPD-7: Missing OpenTelemetry instrumentation and real /health/live & /health/ready probes.")
  }

  return {
    status: issues.length === 0 ? "clean" : "dirty",
    issues,
  }
}

/**
 * Recursively redact Brazilian PII and secrets in structured log payloads with [LGPD_REDACTED].
 */
export function redactBrazilianPiiFromLogObject(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "")
    if (BRAZILIAN_PII_KEYS.has(normalizedKey)) {
      output[key] = "[LGPD_REDACTED]"
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = redactBrazilianPiiFromLogObject(value as Record<string, unknown>)
    } else if (typeof value === "string") {
      // Mask inline CPF patterns (000.000.000-00) in free-text log strings
      output[key] = value.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[LGPD_REDACTED]")
    } else {
      output[key] = value
    }
  }

  return output
}

/**
 * Audit a Teammate's git diff before ensemble_merge for Gitleaks secrets, forbidden .env files,
 * and LGPD violations (such as passing CPF/email/PII in GET query strings).
 */
export function auditDiffForLgpdAndSecrets(input: {
  changedFiles: string[]
  diffContent: string
}): { approved: boolean; violations: string[] } {
  const violations: string[] = []

  for (const file of input.changedFiles) {
    if (/^\.env(\..+)?$/.test(file) || file.endsWith("/.env")) {
      violations.push(`Forbidden .env file in worktree diff: ${file} (use Vault Secret Server).`)
    }
  }

  if (/(sk-live-[a-zA-Z0-9]{16,}|ghp_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16})/.test(input.diffContent)) {
    violations.push("Gitleaks violation: Hardcoded credential or API key detected in diff.")
  }

  if (/@Get\([^)]*(\?|&)(cpf|rg|email|telefone)=/i.test(input.diffContent)) {
    violations.push("LGPD violation: Personal data (CPF/RG/email/telefone) exposed in GET URL query string.")
  }

  return {
    approved: violations.length === 0,
    violations,
  }
}
