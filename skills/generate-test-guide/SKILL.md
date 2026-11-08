---
name: generate-test-guide
description: Automatically generates the 3-layer test guide (Unit, Integration, E2E), shared test harness (scripts/test-env/ and test/utils/), USER_TEST_PLAYBOOK.md, and living gotchas.md.
---

# `generate-test-guide` — Autonomous 3-Layer Test Engineering & Playbook

1. Configures `Unit`, `Integration`, and `E2E` test runners to emit native structured reports (`reports/junit-*.xml`, `reports/test-results-*.json`, `coverage/lcov.info`, `coverage/coverage-summary.json`, and Playwright `trace.zip`).
2. Provisions shared utilities in `scripts/test-env/` (`infra-up.sh`, `tenant-provision.sh`, `db-migrate.sh`, `db-reset.sh`, `run-suite.sh`, `run-phase-gate.sh`).
3. Maintains `docs/testing/USER_TEST_PLAYBOOK.md` and `docs/testing/gotchas.md`.
