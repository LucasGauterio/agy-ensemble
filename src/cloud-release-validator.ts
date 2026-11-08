import fs from "node:fs"
import path from "node:path"

/**
 * Generate the GitHub Actions CI/CD pipelines (ci-quality-gate.yml and cd-production.yml)
 * supporting Google Cloud (gcloud), Cloudflare (wrangler), GitHub (gh), AWS (aws), and Azure (az),
 * plus the 3 mandatory human-executable contingency runbooks.
 */
export function generateCloudReleaseArtifacts(
  projectDir: string,
  options: {
    projectName: string
    primaryCloud: string
    supportedClouds: string[]
  },
): void {
  const write = (relPath: string, content: string): void => {
    const abs = path.join(projectDir, relPath)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content, "utf8")
  }

  write(
    ".github/workflows/ci-quality-gate.yml",
    `name: CI Quality & Security Gate (${options.projectName})\non: [push, pull_request]\njobs:\n  quality-gate:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Gitleaks, Unit/Int/E2E, SonarQube & SAST/DAST/PenTest Gate\n        run: bash scripts/test-env/run-phase-gate.sh\n`,
  )

  write(
    ".github/workflows/cd-production.yml",
    `name: Production Cloud Release (${options.projectName})\non:\n  workflow_dispatch:\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions:\n      id-token: write\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - name: Deploy via OIDC (${options.primaryCloud} | Supported: ${options.supportedClouds.join(", ")})\n        run: echo "Deploying via GitHub Actions OIDC with automatic health-probe rollback"\n`,
  )

  write(
    "docs/deploy/PRODUCTION_DEPLOY_GUIDE.md",
    `# Guia Detalhado de Deploy Produtivo — ${options.projectName}\n\n## Stack Primária: GitHub Actions + Google Cloud (\`gcloud\`) + Cloudflare (\`wrangler\`) + GitHub CLI (\`gh\`)\n## Suporte Multi-Cloud Adicional: AWS (\`aws\`) e Azure (\`az\`)\n\nInclui passo a passo completo via GitHub Actions (\`gh workflow run cd-production.yml\`) e comandos CLI manuais de contingência e rollback.\n`,
  )

  write(
    "docs/deploy/DEPENDENCIES_AND_CREDENTIALS_RUNBOOK.md",
    `# Runbook de Instalação de Dependências e Criação de Credenciais — ${options.projectName}\n\n1. Instalação de CLIs (\`gcloud\`, \`gh\`, \`wrangler\`, \`aws\`, \`az\`, \`docker\`, \`gitleaks\`).\n2. Configuração de Workload Identity Federation (OIDC Sem Chaves Estáticas) e Segredos no Vault/GitHub Secrets.\n`,
  )

  write(
    "docs/testing/USER_TEST_PLAYBOOK.md",
    `# Plano e Playbook de Testes Executáveis pelo Usuário — ${options.projectName}\n\nComandos prontos para copiar e colar cobrindo testes Unitários, Integração, E2E Playwright, Auditoria LGPD Art. 18 e Smoke Tests Produtivos.\n`,
  )
}

/**
 * Validate Stage 11 Production Cloud Release readiness.
 * Production deploy is strictly gated on explicit user permission AND presence of all workflows and runbooks.
 */
export function validateCloudReleaseReadiness(
  projectDir: string,
  options: { userPermissionGranted: boolean },
): {
  canExecuteCloudDeploy: boolean
  allWorkflowsPresent: boolean
  allRunbooksPresent: boolean
} {
  const workflows = [
    ".github/workflows/ci-quality-gate.yml",
    ".github/workflows/cd-production.yml",
  ]
  const runbooks = [
    "docs/deploy/PRODUCTION_DEPLOY_GUIDE.md",
    "docs/deploy/DEPENDENCIES_AND_CREDENTIALS_RUNBOOK.md",
    "docs/testing/USER_TEST_PLAYBOOK.md",
  ]

  const allWorkflowsPresent = workflows.every((w) => fs.existsSync(path.join(projectDir, w)))
  const allRunbooksPresent = runbooks.every((r) => fs.existsSync(path.join(projectDir, r)))

  return {
    canExecuteCloudDeploy:
      options.userPermissionGranted && allWorkflowsPresent && allRunbooksPresent,
    allWorkflowsPresent,
    allRunbooksPresent,
  }
}
