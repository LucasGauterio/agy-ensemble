---
name: design-docs-validate
description: >-
  Valida o pacote de design docs contra docs/_workbench/deliverables-checklist.md
  e os critérios de aceite do enunciado. Emite docs/_workbench/validation-report.md
  com cada critério PASS/FAIL + evidência + score N/total. Último estágio do
  pipeline; também usável isolado via /design-docs-validate.
---

# design-docs-validate: validação dos entregáveis

## Insumos

- `docs/_workbench/deliverables-checklist.md` (ou, na falta, `.claude/requirements/deliverables.default.md`).
- Os artefatos: `docs/PRD.md`, `docs/RFC.md`, `docs/FDD.md`, `docs/adrs/*`,
  `docs/TRACKER.md`, `README.md`, `CLAUDE.md`.
- `SPECIFICATION / INTERVIEW INPUT.md` e o repositório (para validar timestamps e caminhos).
- `.claude/rules/honor-rejected-scope.md`.

## Checagens mecânicas (executar com Grep/rg; registrar evidência)

### Existência e formato
- Cada artefato existe e é Markdown não vazio.
- `docs/adrs/` tem entre 5 e 8 arquivos `ADR-NNN-*.md` (fora o `README.md`).

### PRD
- Seções: Resumo, Problema e motivação, Público-alvo e cenários, Objetivos e métricas,
  Escopo (incluso/fora), Requisitos funcionais, Requisitos não funcionais, Decisões e
  trade-offs, Dependências, Riscos e mitigação, Critérios de aceitação, Testes e validação.
- Contar requisitos funcionais (headings `### FR` ou equivalente) → ≥ 8.
- ≥ 1 objetivo com número/meta na tabela de objetivos.
- "Fora de escopo" com ≥ 2 itens; cada um casa com a lista de `honor-rejected-scope.md`.
- ≥ 2 riscos com "Probabilidade" e "Mitigação".

### RFC
- Seções: metadados (autor/status/data/revisores), TL;DR, Contexto, Proposta técnica,
  Alternativas consideradas, Questões em aberto, Impacto e riscos, Decisões relacionadas.
- Revisores incluem todos os participantes da reunião (campo `reviewers` do run-state).
- ≥ 2 alternativas com "trade-off" / "descartada".
- ≥ 2 questões em aberto.
- ≥ 2 links `](adrs/ADR-` (ou caminho relativo equivalente).
- Tamanho compatível com 2 a 4 páginas (heurística: 250-650 linhas).

### FDD
- 12 seções incl. "Integração com o sistema existente", mais a seção final "Diagramas".
- ≥ 4 blocos de endpoint HTTP com exemplo `json` de request e response e status codes.
- `grep -o 'ERR_[A-Z_]*'` retorna ≥ 5 códigos distintos; nenhum código de erro do
  módulo sem prefixo `ERR_`.
- Seção 12: ≥ 4 arquivos distintos citados; **cada um** como link relativo
  `](../src/...` / `](../prisma/...`, com âncora `#Lnn`; **cada href existe** no repo.
- "Observabilidade" menciona métrica(s), log(s) e tracing/correlação.
- Seção "Diagramas" no fim do arquivo: 4 a 10 blocos ```mermaid, sem elemento ausente do
  corpo; nenhum arquivo `docs/diagrams/` separado.

### ADRs
- Cada arquivo tem: `**Status:**`, `## Contexto`, `## Decisão`, `## Alternativas`,
  `## Consequências`.
- Conjunto cobre ≥ 5 das 6 decisões principais (buscar por palavras-chave: storage layer, retry/
  backoff/DLQ, HMAC, X-Event-Id / at-least-once, worker/polling, reuso/AppError).
- ≥ 1 ADR referencia código real; toda referência de arquivo na seção "Referências" é link
  relativo `](../../src/...` com âncora `#Lnn` e resolve.
- Nenhum ADR com bloco ```` ``` ```` de código-fonte.

### Tracker
- Cabeçalho de tabela com colunas ID, Documento, Tipo, Conteúdo, Fonte, Localização.
- Contar linhas; contar linhas com `SPECIFICATION / INTERVIEW INPUT` + regex `\[\d{2}:\d{2}\] \w+` → ≥ 70%.
- Contar linhas com `CODIGO` + caminho existente → ≥ 5.
- **Toda** célula `Documento` casa `\[[^]]+\]\([^)]+\)` (link); **toda** célula
  `Localização` idem. Zero células em texto plano.
- Extrair cada `href` das colunas `Documento` e `Localização`; resolver relativo a `docs/`;
  **todo arquivo alvo existe**. Linhas `SPECIFICATION / INTERVIEW INPUT` apontam `../SPECIFICATION / INTERVIEW INPUT.md#Lnn`;
  linhas `CODIGO` que citam símbolo têm `#Lnn`.
- Amostrar 10 timestamps e conferir na `SPECIFICATION / INTERVIEW INPUT.md` (o `[hh:mm] Nome` do texto existe
  na linha `#Lnn` apontada); amostrar caminhos `CODIGO` e conferir no repo.
- Estimar cobertura: itens rastreados / itens identificáveis nos docs → ≥ 80%.

### README
- Seções: Sobre o project spec, Ferramentas de IA utilizadas, Workflow adotado, Prompts
  customizados, Iterações e ajustes, Como navegar a entrega.
- ≥ 1 ferramenta de IA; ≥ 2 blocos de código de prompt; ≥ 2 iterações concretas.

### Prosa limpa (rastreabilidade só no Tracker)
- `grep -rnE '\[[0-9]{2}:[0-9]{2}\]' docs/PRD.md docs/RFC.md docs/FDD.md docs/adrs/*.md`
  → **zero** ocorrências. Timestamps reais só no `docs/TRACKER.md` e em
  `docs/_workbench/`. O placeholder de formato `[hh:mm]` (com letras) pode aparecer no
  `README.md` e no plano do processo descrevendo a convenção.
- Nenhum travessão longo (em-dash) em nenhum documento do pacote.

### Links de arquivo do repositório (regra `repo-file-links.md`)
- Em `docs/PRD.md`, `docs/RFC.md`, `docs/FDD.md`, `docs/adrs/*.md`, `docs/TRACKER.md`,
  `README.md`, `CLAUDE.md`: extrair todo link Markdown `](...)` cujo alvo aponta para um
  arquivo do repo (`src/`, `prisma/`, `tests/`, `../SPECIFICATION / INTERVIEW INPUT.md`, outro doc do pacote,
  `.claude/...`, `package.json`, ...). Resolver o caminho relativo a partir da pasta do
  arquivo que linka. **Todo alvo (sem `#Lnn`) existe.**
- Nenhuma menção a `src/...` / `prisma/...` / `tests/...` **em texto plano** (fora de bloco
  de código) nesses documentos: `grep -nE '(^|[^(/\w.])(src|prisma|tests)/[A-Za-z0-9_./-]+\.(ts|prisma|json)' <doc>`
  não deve retornar ocorrência que não esteja dentro de `](...)` ou de ``` ``` ```. Exceção:
  arquivos que a feature vai criar (`src/worker.ts`, `src/modules/external integration APIs/...`) como `code span`.
- Links para código que citam um símbolo específico trazem `#Lnn`; conferir por amostragem
  que a linha apontada contém mesmo a declaração citada.

### Consistência / anti-escopo
- Para cada item de `honor-rejected-scope.md`, `grep` nos docs finais: não pode aparecer
  como requisito/decisão (só em "Fora de escopo" / "Questões em aberto").
- Todo caminho `src/`, `prisma/`, `tests/` citado em qualquer doc existe no repo.

## Saída: `docs/_workbench/validation-report.md`

```markdown
# Relatório de validação: run <id>, iteração <n>

**Score: <N>/<total> critérios**

| # | Critério | Resultado | Evidência |
|---|---|---|---|
| 1 | PRD existe e é Markdown | PASS | docs/PRD.md, 412 linhas |
| 2 | PRD tem ≥ 8 requisitos funcionais | FAIL | encontrados 6 (FR1..FR6) |
| ... | | | |

## Falhas a corrigir
- [critério]: [o que fazer]
```

## Regra

Se `score < total`: não "passar" o pacote. Listar as falhas; a correção é nos **assets do
workflow** ou nas skills de autoria, não maquiar o output. Atualizar `run-state.md`
(`último score de validação`) e, na construção do workflow, o "Log de ciclos de teste" em
`.claude/workflow-build/plan-progress.md`.
