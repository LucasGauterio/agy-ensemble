---
name: design-docs-rfc
description: >-
  Escreve o RFC (Request for Comments) da proposta técnica da feature, em nível
  de arquitetura, submetido à equipe para revisão. Produz docs/RFC.md (2 a 4
  páginas). Roda depois de design-docs-adr; linka os ADRs já escritos.
---

# design-docs-rfc: RFC da proposta técnica

## Insumos

- `docs/adrs/*` (as decisões já fechadas: a RFC linka, não repete).
- `docs/_workbench/transcript-ledger.md` → "Descartados" (viram alternativas) e
  "Adiados / futuro" (viram questões em aberto).
- `.claude/references/architecture/rfc.md` (esqueleto e checklist).
- `docs/_workbench/run-state.md` → `inputs resolvidos` → `reviewers` e `feature.name`
  (derivados da transcrição pelo orquestrador). Sem run-state, tirar os revisores da seção
  de participantes da própria transcrição.
- `.claude/rules/*`.

## Passos

1. Metadados: autor, status "Em revisão", data, revisores = os participantes da reunião
   (`reviewers` do run-state).
2. TL;DR de 3 a 6 linhas.
3. Contexto e problema: por que agora, o que existe hoje, restrições reais. Sem repetir o PRD.
4. Proposta técnica: visão de arquitetura (storage layer + worker separado + assinatura HMAC +
   at-least-once). Prosa e bullets de componente. **Sem** payloads, códigos de erro ou
   fluxo passo a passo (isso é do FDD).
5. Alternativas consideradas: ≥ 2 do ledger ("Descartados"), cada uma com o trade-off
   concreto que motivou o descarte (ex.: disparo síncrono no `changeStatus`; message queue / event stream).
6. Questões em aberto: ≥ 2 do ledger ("Adiados"): ex.: rate limiting de saída; escalar
   para múltiplos workers.
7. Impacto e riscos: resumo do impacto nos sistemas existentes + riscos de arquitetura.
8. Decisões relacionadas: link relativo para ≥ 2 ADRs (`adrs/ADR-00X-....md`), idealmente todos.
9. **Links de arquivo (regra `repo-file-links.md`):** se o RFC mencionar um arquivo real do
   repo (ex.: `src/modules/orders/order.service.ts` no contexto), usar link relativo a
   partir de `docs/` (`../src/...`) com âncora de linha `#Lnn`. `src/worker.ts` e o módulo
   novo ficam como `code span`.
10. **Prosa limpa: sem `[hh:mm]` nem colchetes de timestamp.** A origem vai para o Tracker.
11. Manter em 2 a 4 páginas. Atualizar a linha `rfc` em `docs/_workbench/run-state.md`.

## Saída

`docs/RFC.md`.

## Checklist antes de concluir

- [ ] Metadados com os revisores (todos os participantes da reunião).
- [ ] TL;DR, contexto, proposta, alternativas, questões em aberto, impacto/riscos, decisões
      relacionadas.
- [ ] ≥ 2 alternativas descartadas, cada uma com o trade-off que motivou o descarte.
- [ ] ≥ 2 questões em aberto adiadas na reunião.
- [ ] ≥ 2 links de ADR (relativos, válidos).
- [ ] Toda menção a arquivo real do repo é link relativo com `#Lnn`; nenhum link quebrado.
- [ ] **Sem `[hh:mm]` nem citações de fonte no corpo.**
- [ ] Toda afirmação verificável tem linha correspondente no `docs/TRACKER.md`.
- [ ] 2 a 4 páginas; nenhum detalhe de implementação do FDD.
