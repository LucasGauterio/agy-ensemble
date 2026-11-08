---
name: plan-rule-author
description: Autonomous Stage 10 rule generator that converts <friction-and-learnings> into permanent validation rules in docs/rules/.
---

# `plan-rule-author` — Etapa 10: Autonomous Preventive Rule Generation

Invoked automatically during Stage 10 (`processStage10ContinuousLearning`) whenever `fixLoopAttempts > 1` or an architectural blocker occurred, generating permanent markdown rules in `docs/rules/plan-validate/` and updating `docs/testing/gotchas.md`.
