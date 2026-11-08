---
name: design-docs-tracker
description: >-
  Monta o Tracker de rastreabilidade (docs/TRACKER.md) varrendo PRD, RFC, FDD e
  ADRs e ligando cada item à origem na transcrição ([hh:mm] Nome) ou no código
  (caminho de arquivo). Roda depois que PRD/RFC/FDD/ADR estão prontos.
---

# design-docs-tracker: tracker de rastreabilidade

O `docs/TRACKER.md` é o **único** lugar onde a origem de cada item é materializada. O
PRD/RFC/FDD/ADR têm prosa limpa (sem `[hh:mm]`); esta skill varre esses documentos e liga
cada afirmação à sua origem aqui.

## Insumos

- `docs/PRD.md`, `docs/RFC.md`, `docs/FDD.md`, `docs/adrs/*` (prosa limpa).
- `docs/_workbench/transcript-ledger.md` (guarda os timestamps de cada item).
- `SPECIFICATION / INTERVIEW INPUT.md` (para validar timestamps).
- `.claude/references/codebase/*` e o repositório (para validar caminhos).
- `.claude/references/documentation/tracker.md` (formato + limiares + esquema de IDs).

## Passos

1. Varrer os documentos na ordem PRD → RFC → FDD → ADRs.
2. Para cada afirmação verificável (requisito, RNF, decisão, restrição, trade-off,
   alternativa, questão em aberto, contrato, erro, integração, risco, métrica), criar uma
   linha na tabela com ID prefixado (`PRD-FR-01`, `RFC-ALT-02`, `FDD-CONTRATO-03`,
   `FDD-INT-02`, `ADR-002`, ...).
3. `Documento` = link relativo a partir de `docs/`: `[docs/PRD.md](PRD.md)`,
   `[docs/adrs/ADR-....md](adrs/ADR-....md)`.
4. Preencher `Fonte` (`SPECIFICATION / INTERVIEW INPUT` ou `CODIGO`) e `Localização` (sempre link relativo),
   cruzando com o ledger:
   - `SPECIFICATION / INTERVIEW INPUT` → `[[hh:mm] Nome](../SPECIFICATION / INTERVIEW INPUT.md#Lnn)`. O `[hh:mm] Nome` vem do
     ledger; achar a linha real com `grep -n` na transcrição e pôr como âncora `#Lnn`.
   - `CODIGO` → `[src/...#Lnn](../src/...#Lnn)`. Abrir o arquivo, achar a linha do símbolo,
     usar como âncora. Sem trecho específico, linkar o arquivo sem `#Lnn`.
5. Se um item não tem origem localizável: **voltar ao documento** e corrigir/remover; não
   inventar origem.
6. Conferir os limiares: ≥ 80% de cobertura; ≥ 70% das linhas `SPECIFICATION / INTERVIEW INPUT` com timestamp
   válido; ≥ 5 linhas `CODIGO` com arquivo real; **todo `href` de link resolve**.
7. Atualizar a linha `tracker` em `docs/_workbench/run-state.md`.

## Saída

`docs/TRACKER.md` (tabela no formato obrigatório) + um bloco final "Cobertura" com os
números apurados.

## Checklist antes de concluir

- [ ] Tabela com colunas ID, Documento, Tipo, Conteúdo (resumo), Fonte, Localização.
- [ ] ≥ 80% dos itens dos documentos têm linha.
- [ ] ≥ 70% das linhas: Fonte = SPECIFICATION / INTERVIEW INPUT com `[hh:mm] Nome` válido.
- [ ] ≥ 5 linhas: Fonte = CODIGO com caminho real.
- [ ] Todo timestamp existe na `SPECIFICATION / INTERVIEW INPUT.md`; todo caminho existe no repo.
- [ ] **Toda** célula `Documento` e `Localização` é link relativo `[texto](href)`; nenhum
      `href` quebrado (conferir com um script que testa cada caminho).
- [ ] Linhas `SPECIFICATION / INTERVIEW INPUT` têm âncora `#Lnn`; linhas `CODIGO` que citam um símbolo têm `#Lnn`.
