---
name: design-docs-prd
description: >-
  Escreve o PRD (Product Requirements Document) da feature, em nível de
  produto/negócio. Produz docs/PRD.md. Roda por ÚLTIMO entre os grandes
  documentos (depois de ADR/RFC/FDD): com eles prontos, o PRD é consolidação.
---

# design-docs-prd: PRD da feature

## Insumos

- `docs/_workbench/transcript-ledger.md` → requisitos funcionais (≥ 8), RNFs, riscos,
  descartados/adiados.
- `docs/adrs/*`, `docs/RFC.md`, `docs/FDD.md` (para consolidar decisões e trade-offs em
  nível resumido).
- `.claude/references/documentation/prd.md` (esqueleto de 12 seções + checklist).
- `.claude/rules/*`.

## Passos

1. Seguir o esqueleto da reference.
2. **Requisitos funcionais:** ≥ 8, todos do ledger, cada um com fluxo principal, exceções,
   erros previstos, prioridade. Ex.: cadastrar external integration API (POST), editar (PATCH), remover
   (DELETE), listar por customer (GET), filtrar por status de interesse, histórico de
   entregas (GET deliveries), replay de DLQ (admin), assinatura HMAC no envio, rotação de
   secret, at-least-once com `X-Event-Id`.
3. **Objetivos e métricas:** ≥ 1 com meta quantitativa (ex.: "evento entregue em < 10 s no
   caminho feliz"; base: os clientes consideram "tempo real" abaixo de 10 s).
4. **Fora de escopo:** ≥ 2 itens de `.claude/rules/honor-rejected-scope.md`, cada um com a
   situação em prosa ("adiado para a próxima fase", "fora de escopo, projeto do frontend"),
   sem timestamp.
5. **Riscos:** ≥ 2 completos (probabilidade, impacto, mitigação em subitens, contingência).
6. **Decisões e trade-offs:** resumo; o detalhe fica nos ADRs (linkar com `adrs/ADR-....md`,
   não repetir). Link para o RFC/FDD quando citá-los = `RFC.md`, `FDD.md`.
7. Nível de produto: **não** descer a endpoints, códigos de erro ou infra. Se um arquivo
   real do repo for citado (raro no PRD), é link relativo com `#Lnn` (regra
   `repo-file-links.md`).
8. **Prosa limpa: sem `[hh:mm]` nem colchetes de timestamp.** A origem vai para o Tracker.
9. Atualizar a linha `prd` em `docs/_workbench/run-state.md`.

## Saída

`docs/PRD.md`.

## Checklist antes de concluir

- [ ] 12 seções presentes.
- [ ] ≥ 8 requisitos funcionais, todos discutidos na reunião.
- [ ] ≥ 1 objetivo com métrica e meta quantitativa.
- [ ] "Fora de escopo" com ≥ 2 itens descartados/adiados.
- [ ] "Riscos" com ≥ 2 riscos completos.
- [ ] **Sem `[hh:mm]` nem citações de fonte no corpo.**
- [ ] Toda afirmação verificável tem linha correspondente no `docs/TRACKER.md`.
- [ ] Referências a outro doc do pacote e a arquivo do repo são links relativos válidos.
- [ ] Nada contradiz transcrição/código; não desce ao detalhe do FDD.
