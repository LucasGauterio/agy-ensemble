---
name: screen-inventory
description: Code-First Design System inventory (no Figma required) with automatic LGPD Privacy & Consent UI primitives and Wave Zero isolation.
---

# `screen-inventory` — Code-First Design System (No Figma Required)

1. Operates 100% against `docs/DESIGN_SYSTEM.md` and real codebase components (`src/components/ui/*`) via `buildCodeFirstScreenInventory`.
2. Classifies every component as `<path>` (reuse), `<path> (extend: ...)` (extend), or `<path> (new)` (create in Wave Zero `SI-NN.0.1`).
3. Automatically includes LGPD Privacy by Default UI primitives (`lgpd-consent-banner.tsx` with explicit opt-in and 1-click revocation/export/deletion).
