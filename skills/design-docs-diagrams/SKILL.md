---
name: design-docs-diagrams
description: >-
  Escreve a seção "Diagramas" do FDD (última seção de docs/FDD.md), com os
  diagramas Mermaid da feature (fluxo da storage layer, worker, retry/DLQ, máquina de
  estados do evento, replay, modelo de dados). Acionada por design-docs-fdd, ou
  isolada via /design-docs-diagrams depois que o texto do FDD existe.
---

# design-docs-diagrams: seção de diagramas do FDD

Os diagramas ficam **embutidos no FDD**, não num arquivo separado. Esta skill é dona da
última seção de `docs/FDD.md` (a seção "Diagramas"); as demais seções são do
`design-docs-fdd`.

## Insumos

- `docs/FDD.md` (fonte única; não inventar elementos fora dele). O texto das seções 1 a N
  já deve existir.
- `.claude/references/architecture/diagrams.md` (tipos, guardrails de sintaxe, teste de
  significância, lista dos diagramas esperados).

## Passos

1. Ler o FDD por completo; detectar idioma (PT) e elementos explícitos. Anotar o número da
   última seção numerada (os diagramas entram como a seção seguinte).
2. Para cada diagrama candidato, aplicar o teste de significância (5 perguntas da
   reference). Descartar os redundantes com a prosa.
3. Adicionar ao fim do `docs/FDD.md` uma seção `## <N+1>. Diagramas` com um parágrafo de
   abertura e 4 a 6 subseções (`### <N+1>.1` ...), no máximo 10. Cada subseção: título,
   parágrafo descritivo de 3 a 5 frases que aponta a seção do FDD que ela ilustra, bloco
   ```mermaid e um bloco **Notas:**.
4. Respeitar os guardrails de sintaxe Mermaid (IDs ASCII, labels ≤ 3 palavras, `<br/>`,
   sem `min(`/`++`/`{}` em labels, sequence vs flowchart não se misturam, sem emoji).
5. Texto em PT com acentos; termos técnicos em inglês. Dentro de bloco ```mermaid não há
   link; mas se o **parágrafo descritivo** ou as **Notas:** citarem um arquivo real do
   repo, é link relativo a partir de `docs/` (`../src/...`) com `#Lnn` (regra
   `repo-file-links.md`).
6. Acrescentar, na seção de fluxos do FDD, uma frase curta apontando para a seção de
   diagramas (se ainda não existir).
7. Revisão interna: reler FDD inteiro, corrigir inconsistências e elementos inventados.
8. Atualizar a linha `diagrams` em `docs/_workbench/run-state.md`.

## Saída

Seção "Diagramas" acrescentada ao fim de `docs/FDD.md`. Nenhum arquivo novo.

## Checklist antes de concluir

- [ ] Seção única, no fim do `docs/FDD.md`, numerada na sequência das demais.
- [ ] 4 a 10 diagramas, cada um passando no teste de significância, sem redundância com a prosa.
- [ ] Cada diagrama aponta a seção do FDD que ilustra.
- [ ] Nenhum elemento ausente do corpo do FDD.
- [ ] Sintaxe Mermaid válida (guardrails).
- [ ] PT com acentos; termos técnicos em inglês; labels curtos.
- [ ] Sem `[hh:mm]` e sem travessão longo (em-dash).
