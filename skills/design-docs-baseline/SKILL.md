---
name: design-docs-baseline
description: >-
  Primeiro passo do workflow design-docs. Inspeciona o código de uma aplicação
  JÁ EXISTENTE e produz o baseline: CLAUDE.md (contexto da aplicação) e
  .claude/references/codebase/ (mapa detalhado + pontos de extensão). Use antes
  de analisar qualquer transcrição de reunião. IGNORA os arquivos do project spec
  (PROJECT SPEC.md, SPECIFICATION / INTERVIEW INPUT.md, README.md): eles não descrevem a aplicação.
---

# design-docs-baseline: baseline da aplicação existente

## Objetivo

Antes de projetar qualquer feature nova, é preciso um retrato fiel do que já existe.
Esta skill lê o código-fonte e escreve três artefatos que servem de contexto estável
para todas as etapas seguintes do workflow.

## Regras

1. **Fonte = só o código.** Baseie tudo em `src/`, `prisma/`, `tests/`, configs de build,
   `package.json`, `docker-compose.yml`. **Não leia nem cite** `PROJECT SPEC.md`, `SPECIFICATION / INTERVIEW INPUT.md`
   ou o `README.md`: esses arquivos são sobre um project spec/feature futura, não sobre a
   aplicação implementada.
2. **Nada de feature nova.** O baseline descreve o sistema como ele é hoje. Se um mecanismo
   não existe no código (fila, evento, external integration API, cache...), registre isso como **ausência
   observada**, não como algo a construir.
3. **Rastreável, com link.** Toda afirmação relevante aponta para um arquivo real, e a
   referência é um **link relativo** (regra `repo-file-links.md`): a partir de `CLAUDE.md`
   o caminho é `src/...`; a partir de `.claude/references/codebase/` é `../../../src/...`.
   Quando a afirmação cita um símbolo (função, classe, middleware, model, campo), o link
   leva **âncora de linha `#Lnn`** da declaração; referência ao arquivo como um todo pode
   ir sem âncora.
4. **Não altere código.** Só cria/atualiza os três arquivos de saída abaixo.

## Passos

1. Mapear a estrutura: linguagem, framework, gerenciador de pacotes, versões
   (`package.json`, lockfile), scripts, camadas de pastas.
2. Identificar os entrypoints (servidor HTTP, workers, CLIs, seeds) e o wiring de
   dependências / injeção.
3. Levantar o modelo de dados (ORM/migrations): entidades, relações, índices, enums,
   invariantes (transações, sequências, histórico/auditoria).
4. Levantar convenções transversais: autenticação/autorização, tratamento de erros,
   logging, validação de entrada, formato de resposta HTTP, configuração/env.
5. Levantar a suíte de testes: ferramenta, o que cobre, helpers/factories.
6. Listar **ausências observadas** relevantes para design de features (mensageria,
   eventos, agendamento, cache, notificação externa, rate limiting...).
7. Escrever os três arquivos de saída.

## Saídas

### 1. `CLAUDE.md` (raiz do repo)

Contexto operacional da aplicação para humanos e para o agente. Curto e factual.
Seções sugeridas:

- **O que é**: tipo de sistema, domínio, em uma frase.
- **Stack**: runtime, linguagem, framework, ORM, banco, libs centrais, com versões.
- **Estrutura**: como os módulos/pastas se organizam e o padrão que cada módulo segue.
- **Convenções transversais**: auth, erros e códigos de erro, logging, validação,
  resposta HTTP, configuração.
- **Modelo de dados**: entidades principais e invariantes (transações, auditoria).
- **Entrypoints e execução**: como rodar, migrar, semear, testar.
- **Ausências**: o que o sistema deliberadamente ainda não tem.
- **Regras para o agente**: não editar `src/`, `prisma/`, `tests/`, configs; a entrega
  deste repositório é documental. Referência às rules em `.claude/rules/` (uma linha por
  rule, com link relativo).

Não incluir: roadmap, features futuras, nada derivado do project spec.

Referências a arquivo neste `CLAUDE.md`: link relativo (`[\`src/app.ts\`](src/app.ts)`),
com `#Lnn` quando a linha cita um símbolo. A tabela/árvore de estrutura pode usar
`code span` simples para não virar uma parede de links; o resto do texto linka.

### 2. `.claude/references/codebase/existing-app.md`

Mapa detalhado, mais longo que o `CLAUDE.md`, para consulta durante a autoria dos docs:
entrypoints com caminho, wiring de DI, tabela de módulos (arquivos e responsabilidade),
modelo de dados por entidade, máquina(s) de estado, fluxos transacionais críticos,
middlewares na ordem, classes de erro e seus códigos/status, formato de log, testes.
Cada caminho de arquivo é link relativo a partir de `.claude/references/codebase/`
(`../../../src/...`), com âncora `#Lnn` no símbolo citado.

### 3. `.claude/references/codebase/integration-points.md`

Catálogo dos **pontos de extensão** que uma feature nova provavelmente vai tocar, cada um
com: **link relativo com âncora de linha** para o arquivo/símbolo (`#Lnn`), o que faz hoje,
como uma feature se conectaria, cuidado/risco. Exemplos de categorias: métodos de serviço
transacionais, middlewares, classes de erro reutilizáveis, máquina de estados, entrypoints
novos, cliente de banco por processo. Esta é a matéria-prima da seção "Integração com o
sistema existente" do FDD, então os links já vêm prontos para reaproveitar (ajustando o
prefixo relativo de `../../../src/...` para `../src/...`).

## Conclusão

Ao terminar, atualizar a linha `baseline` em `docs/_workbench/run-state.md` (se existir)
e, no contexto de construção do workflow, marcar o item correspondente em
`.claude/workflow-build/plan-progress.md`.
