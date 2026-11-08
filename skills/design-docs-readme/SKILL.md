---
name: design-docs-readme
description: >-
  Reescreve o README.md da raiz com a documentação do PROCESSO de produção do
  pacote de design docs: ferramentas de IA, workflow adotado, prompts
  customizados, iterações e ajustes, como navegar a entrega. Roda por último.
---

# design-docs-readme: README do processo

## Insumos

- `.claude/workflow-build/plan-progress.md` → "Log de ciclos de teste" (iterações reais).
- `docs/_workbench/run-state.md` e `validation-report.md` (o que passou/falhou por ciclo).
- As skills e commands do workflow (fonte dos "prompts customizados").
- `DESIGN_DOCS_PROCESS.md` (referência do processo completo).

## Estrutura obrigatória do novo README

```markdown
# <título>

## Sobre o project spec
[1 a 2 parágrafos, nas suas palavras: transformar a transcrição + o código em PRD, RFC,
FDD, ADRs, Tracker e este README, sem inventar requisitos.]

## Ferramentas de IA utilizadas
- **Claude Code (Sonnet 5)**: leitura do repo e da transcrição, construção do workflow
  `design-docs` (skills/commands/rules/references) e geração dos documentos.
- [outras, se usadas, com o papel de cada uma]

## Workflow adotado
[Ordem: baseline do código → ledger da transcrição + checklist da spec → ADRs → RFC →
FDD (com diagramas embutidos) → PRD → Tracker → este README. Como a interação com a IA foi
organizada:
skills por documento, references de método em `.claude/references/`, worktrees por execução.]

## Prompts customizados
Pelo menos 2, em blocos de código. Ex.: o corpo de `.claude/skills/design-docs-ledger/SKILL.md`
(extração dirigida por bucket) e de `.claude/skills/design-docs-fdd/SKILL.md` (seção de
integração com ≥ 4 arquivos reais).

## Iterações e ajustes
Pelo menos 2 momentos concretos em que a IA errou/ficou superficial e foi corrigida
(do "Log de ciclos de teste" em plan-progress.md). Quantos ciclos principais até o resultado.

## Como navegar a entrega
Ordem sugerida de leitura, cada arquivo como **link relativo a partir da raiz** (regra
`repo-file-links.md`):
1. [`CLAUDE.md`](CLAUDE.md): contexto da aplicação
2. [`docs/PRD.md`](docs/PRD.md): por quê e o quê
3. [`docs/RFC.md`](docs/RFC.md): proposta técnica
4. [`docs/adrs/`](docs/adrs/): decisões
5. [`docs/FDD.md`](docs/FDD.md) (com a seção de diagramas ao fim): como implementar
6. [`docs/TRACKER.md`](docs/TRACKER.md): rastreabilidade
7. [`DESIGN_DOCS_PROCESS.md`](DESIGN_DOCS_PROCESS.md): o processo completo
```

Manter um link para o enunciado original ([`PROJECT SPEC.md`](PROJECT SPEC.md)). Toda menção a
arquivo do repo no README (skills, docs, rules) é link relativo; o `README.md` fica na
raiz, então os caminhos são diretos (`docs/...`, `.claude/...`).

## Checklist antes de concluir

- [ ] 6 seções obrigatórias presentes.
- [ ] ≥ 1 ferramenta de IA listada com o papel.
- [ ] ≥ 2 prompts customizados em blocos de código.
- [ ] ≥ 2 iterações/ajustes concretos descritos.
- [ ] Ordem de leitura com caminhos reais, cada um link relativo que resolve.
- [ ] Toda outra menção a arquivo do repo no corpo também é link relativo.
- [ ] Atualizar a linha `readme` em `docs/_workbench/run-state.md`.
