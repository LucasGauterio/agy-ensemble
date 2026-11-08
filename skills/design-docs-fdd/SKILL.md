---
name: design-docs-fdd
description: >-
  Escreve o FDD (Feature Design Document): o "como implementar" em detalhe,
  acionável para um dev começar a codar. Produz docs/FDD.md com contratos,
  matriz de erros ERR_*, fluxos e a seção obrigatória "Integração com o
  sistema existente". Os diagramas ficam embutidos no próprio FDD (última seção).
  Roda depois de design-docs-rfc; ao final aciona design-docs-diagrams.
---

# design-docs-fdd: FDD da feature

## Insumos

- `docs/adrs/*` e `docs/RFC.md` (decisões e proposta: o FDD constrói em cima, não reabre).
- `docs/_workbench/transcript-ledger.md` → requisitos funcionais, RNFs, restrições, detalhes
  técnicos secundários (formato do payload, headers, timeout 10 s, snapshot na inserção).
- `.claude/references/architecture/fdd.md` (esqueleto de 12 seções + checklist).
- `.claude/references/codebase/integration-points.md` (PE-01..PE-11): base da seção 12.
- `.claude/references/codebase/existing-app.md`.
- `.claude/rules/*`.

## Passos

1. Seguir o esqueleto de 12 seções da reference.
2. **Contratos públicos (seção 5):** ≥ 4 endpoints HTTP, cada um com auth, status codes,
   exemplo de request e de response em ```json. Cobrir no mínimo: `POST` cadastro de
   external integration API, `PATCH`/`DELETE`/`GET` de configuração, `GET /external integration APIs/:id/deliveries`,
   `POST /admin/external integration APIs/dead-letter/:id/replay`. Documentar também o payload enviado ao
   cliente e a semântica dos headers `X-Event-Id`, `X-Signature`, `X-Timestamp`,
   `X-External integration api-Id`.
3. **Matriz de erros (seção 6):** tabela com códigos exclusivamente `ERR_*`
   (`ERR_NOT_FOUND`, `ERR_INVALID_URL`, `ERR_SECRET_REQUIRED`, ...), HTTP,
   condição, tratamento.
4. **Fluxos (seção 4):** storage layer (inserção dentro da `$transaction` de `changeStatus`),
   worker (polling 2 s), retry (5 tentativas, 1m/5m/30m/2h/12h), DLQ (tabela separada, replay).
5. **Observabilidade (seção 8):** métricas **e** logs **e** tracing/correlação.
6. **Integração com o sistema existente (seção 12):** nomear **≥ 4 arquivos reais** e
   descrever a integração de cada. Usar os PE do `integration-points.md`. Cobrir pelo menos
   `src/modules/orders/order.service.ts`, `src/shared/errors/app-error.ts`,
   `src/middlewares/auth.middleware.ts`, `src/config/database.ts` (worker com Prisma próprio).
7. **Links de arquivo (regra `repo-file-links.md`):** toda menção a um arquivo real do repo,
   em qualquer seção, é **link relativo a partir de `docs/`** (`../src/...`), com **âncora
   de linha `#Lnn`** no símbolo citado. Abrir o arquivo e pegar a linha real. Arquivos que
   a feature vai criar (`src/worker.ts`, `src/modules/external integration APIs/*`) ficam como `code span`,
   com nota de que são novos: nunca linkar caminho inexistente.
8. **Prosa limpa: sem `[hh:mm]` nem colchetes de timestamp** em nenhuma seção. A origem de
   cada afirmação vai para o Tracker.
9. Ao terminar o texto, **invocar `design-docs-diagrams`** para acrescentar a seção
   "Diagramas" ao fim do próprio `docs/FDD.md` (não há arquivo de diagramas separado).
10. Atualizar as linhas `fdd` (e depois `diagrams`) em `docs/_workbench/run-state.md`.

## Saída

`docs/FDD.md` (a seção "Diagramas" é acrescentada por `design-docs-diagrams`).

## Checklist antes de concluir

- [ ] 12 seções presentes, incl. "Integração com o sistema existente" (a 13ª, "Diagramas",
      vem do `design-docs-diagrams`).
- [ ] ≥ 4 endpoints com request/response de exemplo e status codes.
- [ ] Matriz de erros só com `ERR_*`.
- [ ] Fluxos cobrem storage layer, worker, retry, DLQ.
- [ ] Observabilidade cita métricas, logs e tracing.
- [ ] Seção 12 nomeia ≥ 4 arquivos que existem no repositório, cada um link relativo com `#Lnn`.
- [ ] Toda menção a arquivo real do repo (qualquer seção) é link relativo; `src/worker.ts` e
      `src/modules/external integration APIs/*` ficam como `code span` (são novos). Nenhum link quebrado.
- [ ] **Sem `[hh:mm]` nem citações de fonte no corpo.**
- [ ] Toda afirmação verificável tem linha correspondente no `docs/TRACKER.md`.
- [ ] Não repete narrativa de negócio do PRD nem reabre decisão de ADR.
- [ ] Seção "Diagramas" presente no fim do `docs/FDD.md`.
