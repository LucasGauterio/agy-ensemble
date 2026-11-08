---
name: cloud-release
description: Stage 11 Production Cloud Deployment skill (GitHub Actions First + gcloud, gh, wrangler, aws, az) and generator of the 3 mandatory human-executable contingency runbooks.
---

# `cloud-release` — Etapa 11: Production Cloud Deployment & Contingency Runbooks

1. Always generates and keeps updated via `generateCloudReleaseArtifacts`:
   - `.github/workflows/ci-quality-gate.yml`
   - `.github/workflows/cd-production.yml` (OIDC keyless auth + automatic rollback)
   - `docs/deploy/PRODUCTION_DEPLOY_GUIDE.md`
   - `docs/deploy/DEPENDENCIES_AND_CREDENTIALS_RUNBOOK.md`
   - `docs/testing/USER_TEST_PLAYBOOK.md`
2. When `validateCloudReleaseReadiness(projectDir, { userPermissionGranted: true })` passes, triggers and monitors the production deployment via GitHub Actions (`gh workflow run cd-production.yml`) integrated with Google Cloud (`gcloud`), Cloudflare (`wrangler`), AWS (`aws`), or Azure (`az`).
