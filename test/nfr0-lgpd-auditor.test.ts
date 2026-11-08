import { describe, expect, test } from "bun:test"
import {
  auditDiffForLgpdAndSecrets,
  redactBrazilianPiiFromLogObject,
  validatePhasePlanMandateNfr0AndLgpd,
} from "../src/nfr0-lgpd-auditor"

describe("IMP-08 / VAL-08: Mandate NFR-0 & Mandatory Brazilian LGPD Compliance (Lei 13.709/2018)", () => {
  test("automatically enforces LGPD ROPA, Art. 18 Data Subject Rights, Vault Transit encryption + HMAC blind index, and blocks non-compliant plans (SEC-OBS-LGPD-N)", () => {
    const invalidPlanCheck = validatePhasePlanMandateNfr0AndLgpd({
      handlesPersonalData: true,
      hasLgpdRopaTable: false,
      hasArt18ExportAndAnonymization: false,
      hasVaultTransitFieldEncryption: false,
      hasConsentLedgerOptIn: false,
      hasVaultSecretPaths: true,
      hasStructuredJsonLoggingWithBrRedaction: true,
      hasOpenTelemetryProbes: true,
    })

    expect(invalidPlanCheck.status).toBe("dirty")
    expect(invalidPlanCheck.issues.some((i) => i.startsWith("SEC-OBS-LGPD-"))).toBe(true)

    const validPlanCheck = validatePhasePlanMandateNfr0AndLgpd({
      handlesPersonalData: true,
      hasLgpdRopaTable: true,
      hasArt18ExportAndAnonymization: true,
      hasVaultTransitFieldEncryption: true,
      hasConsentLedgerOptIn: true,
      hasVaultSecretPaths: true,
      hasStructuredJsonLoggingWithBrRedaction: true,
      hasOpenTelemetryProbes: true,
    })
    expect(validPlanCheck.status).toBe("clean")
  })

  test("redacts Brazilian PII (CPF, CNPJ, RG, email, phone, PIX, password, token) with [LGPD_REDACTED] and blocks diffs containing .env files, hardcoded secrets, or PII in GET query strings", () => {
    const rawLog = {
      event: "user.registered",
      cpf: "123.456.789-00",
      email: "titular@empresa.com.br",
      telefone: "+5511999998888",
      pixKey: "12345678900",
      password: "super-secret-password",
      nested: { rg: "12.345.678-9" },
    }

    const redacted = redactBrazilianPiiFromLogObject(rawLog)
    expect(redacted.cpf).toBe("[LGPD_REDACTED]")
    expect(redacted.email).toBe("[LGPD_REDACTED]")
    expect(redacted.telefone).toBe("[LGPD_REDACTED]")
    expect(redacted.pixKey).toBe("[LGPD_REDACTED]")
    expect(redacted.password).toBe("[LGPD_REDACTED]")
    expect((redacted.nested as Record<string, unknown>).rg).toBe("[LGPD_REDACTED]")

    // Diff audit must reject .env files, leaked secrets, or GET routes with CPF/PII in query string
    const badDiff = auditDiffForLgpdAndSecrets({
      changedFiles: [".env.production", "src/users/users.controller.ts"],
      diffContent: `
        + const apiKey = "sk-live-9876543210abcdef9876543210abcdef"
        + @Get("/users/search?cpf=:cpf")
      `,
    })
    expect(badDiff.approved).toBe(false)
    expect(badDiff.violations.length).toBeGreaterThanOrEqual(3)
  })
})
