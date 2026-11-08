---
name: design-docs-ledger
description: >-
  Terceiro passo do workflow design-docs. Faz extração DIRIGIDA (não genérica) da
  transcrição da reunião para docs/_workbench/transcript-ledger.md, separando
  decisões fechadas, requisitos funcionais, RNFs, restrições, ganchos com o
  código, itens DESCARTADOS, itens ADIADOS e detalhes técnicos secundários. Cada
  item traz a origem [hh:mm] Nome. É o arquivo de trabalho que alimenta o conteúdo do
  PRD/RFC/FDD/ADR (prosa, sem timestamps) e as linhas do TRACKER (com timestamps).
---

# design-docs-ledger: ledger da transcrição

## Objetivo

Ler a transcrição uma vez, com atenção, e produzir um índice estruturado de tudo que foi
dito, **classificado**. Nem tudo que foi mencionado vira requisito. Identificar o que NÃO
entra é tão importante quanto o que entra.

## Insumos

- `docs/_workbench/run-state.md` → `inputs resolvidos` → `transcript` (o documento que o
  usuário passou em `/design-docs @arquivo.md`). Se a skill for chamada isolada, aceitar o
  caminho como argumento; sem nada, cair em `SPECIFICATION / INTERVIEW INPUT.md`.
- `.claude/references/codebase/*` (para reconhecer os ganchos com o código).
- `.claude/rules/honor-rejected-scope.md`.

## Método (dirigido, seção por seção)

Percorra a transcrição do início ao fim. Para **cada fala relevante**, decida a qual bucket
ela pertence e registre com `[hh:mm] Nome`. Não resuma a reunião em prosa; classifique.

Perguntas dirigidas por bucket:

- **Decisão fechada**: alguém propôs, houve concordância explícita ("decidido", "fechado",
  "anota", "beleza") e não foi revertida depois? Registre a decisão e a alternativa que
  perdeu.
- **Requisito funcional**: o cliente/PM pediu que o sistema faça X? (endpoints, filtros,
  histórico de entregas, replay...).
- **Requisito não funcional**: número, limite, garantia, restrição de qualidade (latência
  < 10 s, payload ≤ 64 KB, at-least-once, TLS obrigatório, timeout 10 s).
- **Restrição / gancho com o código**: "dentro da mesma transação de `changeStatus`",
  "mesmo Prisma", "reusa `AppError`", "role ADMIN via `requireRole`".
- **Descartado**: foi levantado e **rejeitado** ("não rola", "fora de escopo", "não").
- **Adiado / futuro**: foi levantado e empurrado ("próxima fase", "observar e decidir
  depois", "problema do futuro").
- **Detalhe técnico secundário**: decidido mas de baixo impacto (formato do payload,
  conjunto de headers, UUID vs auto-incremento, snapshot na inserção). Pode virar ADR extra
  ou ficar só no FDD.

## Saída: `docs/_workbench/transcript-ledger.md`

```markdown
# Ledger da transcrição

Fonte: <transcript>: reunião de ~<duração>, participantes: <Nome (papel), ...>
(os mesmos do campo `reviewers` do run-state)

## Decisões fechadas
| # | Decisão | Alternativa descartada | Origem |
|---|---|---|---|
| D1 | ... | ... | [hh:mm] Nome |

## Requisitos funcionais
| # | Requisito | Detalhes / fluxo | Origem |
|---|---|---|---|
| FR1 | ... | ... | [hh:mm] Nome |

## Requisitos não funcionais
| # | RNF | Valor / garantia | Origem |
|---|---|---|---|

## Restrições e ganchos com o código
| # | Restrição | Arquivo/módulo do baseline | Origem |
|---|---|---|---|

## Descartados
| Item | Motivo | Origem |
|---|---|---|

## Adiados / futuro
| Item | Motivo | Origem |
|---|---|---|

## Detalhes técnicos secundários
| Item | Decisão | Vira ADR? | Origem |
|---|---|---|---|
```

## Regras

- Todo item tem `[hh:mm] Nome` real. Sem timestamp = não entra no ledger.
- Uma fala pode gerar mais de um item (ex.: uma decisão + um RNF).
- Não classifique como "decisão fechada" algo que ficou em aberto no fim da reunião.
- Ao terminar, atualizar a linha `ledger` em `docs/_workbench/run-state.md` (se existir).
