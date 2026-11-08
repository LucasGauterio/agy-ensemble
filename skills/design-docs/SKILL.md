---
name: design-docs
description: >-
  Orquestrador do workflow design-docs. Executa o pipeline completo: baseline da
  aplicação, análise da spec e da transcrição, ADRs, RFC, FDD (+ diagramas), PRD,
  Tracker e README do processo: na ordem do enunciado, parando para validar
  entre blocos. É RETOMÁVEL: lê docs/_workbench/run-state.md e continua do
  primeiro estágio não concluído. Use /design-docs @SPECIFICATION / INTERVIEW INPUT.md para começar;
  /design-docs (sem argumento) para retomar; /design-docs --restart para recomeçar.
---

# design-docs: pipeline completo

## Entrada

A transcrição é informada **na chamada da skill**, como documento referenciado:
`/design-docs @SPECIFICATION / INTERVIEW INPUT.md`. Não existe arquivo de config: os parâmetros da run são
derivados desse documento e gravados em `docs/_workbench/run-state.md`.

Argumentos aceitos (`$ARGUMENTS`):

- **1º argumento** (obrigatório numa run nova): o documento da transcrição da reunião
  (`@arquivo.md` ou caminho). Vira o input `transcript`.
- **2º argumento** (opcional): caminho da spec/enunciado. Se omitido, usar `PROJECT SPEC.md`
  quando existir na raiz; se não existir, seguir só com
  `.claude/requirements/deliverables.default.md` e marcar `spec: (nenhuma)`.
- **`--restart`**: ignora o run-state atual e recomeça do zero.
- **`--nao-interativo`** (ou execução via `claude -p`, sem TTY): **não pare nos
  checkpoints**. Em cada checkpoint, escreva a nota de revisão no run-state (campo
  `notas de checkpoint`) e siga direto para o próximo estágio. Commits por estágio viram
  best-effort: se `git commit` for bloqueado, seguir e deixar tudo no working tree.
- Sem nenhum argumento: retomar a run em andamento.

## Resolução dos inputs (fazer no início de uma run nova)

1. `transcript` = o documento passado no 1º argumento. Abortar com mensagem clara se uma
   run nova for iniciada sem ele.
2. `spec` = 2º argumento, senão `PROJECT SPEC.md` se existir, senão `(nenhuma)`.
3. `outputDir` = `docs` (fixo).
4. Ler a transcrição e derivar:
   - `feature.name`: do título/cabeçalho da transcrição (ex.: linha "Reunião: Sistema de
     External integration apis de Notificação de Pedidos" → `Sistema de External integration apis de Notificação de Pedidos`).
     Se não houver título explícito, inferir do assunto declarado nas primeiras falas e
     marcar `(inferido)`.
   - `feature.slug`: kebab-case curto do nome (ex.: `external integration APIs`). 1 a 2 palavras.
   - `reviewers`: a lista de participantes da transcrição (seção "Participantes" ou as
     apresentações iniciais), no formato `Nome (papel)`. Sem inventar participantes.
5. Gravar tudo no bloco `inputs resolvidos` do `docs/_workbench/run-state.md`.

As skills seguintes (`design-docs-spec`, `-ledger`, `-rfc`) leem esses valores do
`run-state.md`; não há outra fonte de configuração.

## Retomada (fazer sempre no início)

1. Se `docs/_workbench/run-state.md` existe e não veio `--restart`: retomar do primeiro
   estágio com status ≠ `concluído` (os inputs já estão resolvidos no arquivo).
2. Se não existe (ou `--restart`): resolver os inputs (acima) e criar
   `docs/_workbench/run-state.md` a partir do template abaixo, todos os estágios `pendente`.

### Template `docs/_workbench/run-state.md`

```markdown
# Estado da execução do workflow design-docs

- **run id:** <timestamp>
- **inputs resolvidos:**
  - transcript: <caminho do documento passado na chamada>
  - spec: <2º argumento | PROJECT SPEC.md | (nenhuma)>
  - outputDir: docs
  - feature.name: <derivado do título da transcrição>
  - feature.slug: <kebab-case curto>
  - reviewers: <Nome (papel), ... : participantes da transcrição>
- **iteração:** 1
- **modo:** interativo | nao-interativo
- **último score de validação:** (ainda não rodou)
- **notas de checkpoint:** (preenchido no modo não-interativo)
- **próxima ação:** rodar estágio `baseline`

| Estágio | Status | Saída |
|---|---|---|
| baseline | pendente | `CLAUDE.md`, `.claude/references/codebase/*` |
| spec | pendente | `docs/_workbench/deliverables-checklist.md` |
| ledger | pendente | `docs/_workbench/transcript-ledger.md` |
| adr | pendente | `docs/adrs/ADR-*.md` |
| rfc | pendente | `docs/RFC.md` |
| fdd | pendente | `docs/FDD.md` |
| diagrams | pendente | seção "Diagramas" em `docs/FDD.md` |
| prd | pendente | `docs/PRD.md` |
| tracker | pendente | `docs/TRACKER.md` |
| readme | pendente | `README.md` |
| validation | pendente | `docs/_workbench/validation-report.md` |
```

## Ordem de execução

Para cada estágio ainda `pendente`, marcar `em progresso`, invocar a skill, marcar
`concluído`, atualizar "próxima ação" e commitar (`chore(run): <estágio>`). Commit
bloqueado (ambiente sem permissão) não trava o pipeline: seguir e deixar no working tree.

1. `baseline` → skill **design-docs-baseline**
2. `spec` → skill **design-docs-spec**
3. `ledger` → skill **design-docs-ledger**
  : **checkpoint:** revisar o ledger (classificação correta? descartados de fora?). No modo
   não-interativo, registrar a nota no run-state e seguir.
4. `adr` → skill **design-docs-adr**
5. `rfc` → skill **design-docs-rfc**
  : **checkpoint:** ADR + RFC prontos para revisão. (não-interativo: seguir)
6. `fdd` → skill **design-docs-fdd** (que aciona **design-docs-diagrams** → estágio
   `diagrams`, que acrescenta a seção "Diagramas" ao fim do `docs/FDD.md`)
7. `prd` → skill **design-docs-prd**
  : **checkpoint:** FDD + PRD prontos para revisão. (não-interativo: seguir)
8. `tracker` → skill **design-docs-tracker**
9. `readme` → skill **design-docs-readme**
10. `validation` → skill **design-docs-validate**

## Ao final

- Se `validation` não atingiu 100% dos critérios: registrar as falhas em
  `.claude/workflow-build/plan-progress.md` ("Log de ciclos de teste"), ajustar os
  **assets do workflow** (não o output), incrementar `iteração` e rodar de novo do estágio
  afetado.
- Se 100%: reportar o caminho de cada artefato e o score.

## Regras

- Uma skill por estágio; nunca pular a ordem.
- Todo estágio respeita `.claude/rules/*`.
- `docs/_workbench/` não entra no entregável final `dev`.
