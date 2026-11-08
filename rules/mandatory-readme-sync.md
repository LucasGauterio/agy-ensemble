# Regra Mandatória: Sincronia Contínua do README (Mandato README-SYNC-0)

> [!IMPORTANT]
> **Mandato README-SYNC-0 Inegociável — Sincronização Obrigatória e Contínua de Documentação**
> Esta regra governa tanto os projetos gerados pela skill **`agy-ensemble`** quanto a própria governança da skill. O `README.md` é o cartão de visitas e o contrato operacional imediato de qualquer repositório; mantê-lo desatualizado é uma violação grave de engenharia de software e bloqueia formalmente o avanço de fases.

---

## 1. Regra para Projetos Gerados / Governados pela Skill

Em qualquer projeto onde o workflow `agy-ensemble` atue (novo ou brownfield):

1. **Gate no Encerramento de cada Fase (Etapa 9 / Etapa 10):**
   - Antes de considerar qualquer fase (`phase-NN-*`) como concluída e antes de executar o squash merge na branch principal (`main`/`master`), o Lead Agente DEVE auditar e atualizar o `README.md` da raiz do repositório.
   - O `README.md` DEVE obrigatoriamente refletir:
     - **Visão Geral e Status Atualizado:** Adicionar a fase recém-concluída na seção de roadmap/entregas com sumário claro de suas capacidades.
     - **Novos Endpoints ou Telas:** Listar novas rotas de API, telas ou componentes públicos criados durante a fase.
     - **Variáveis de Ambiente:** Qualquer nova variável adicionada em `.env.example` DEVE ser documentada no `README.md` com seu propósito, formato e se é mandatória ou opcional.
     - **Instruções de Execução e Testes:** Comandos atualizados para subir o ambiente localmente (e.g. `docker compose up -d`, migrations) e executar os testes unitários, de integração e E2E.
   - **Bloqueio Automático:** O gate `evaluatePhaseReadmeSync` avalia essas condições. Se houver defasagem, a conclusão da fase é abortada com status bloqueante até a correção.

2. **Gate no Onboarding Brownfield (Etapa 0.0):**
   - A presença de um `README.md` válido, legível e não-vazio na raiz do repositório é um **artefato obrigatório** no `MANDATORY_WORKFLOW_ARTIFACTS`.
   - Se o projeto brownfield existente não tiver `README.md`, o motor de engenharia reversa deve gerar o arquivo inicial descrevendo a aplicação, a stack detectada, portas e comandos de execução antes de autorizar qualquer novo trabalho de feature.

---

## 2. Regra para a Própria Skill `agy-ensemble`

1. **Evolução da Skill:**
   - Sempre que uma nova ferramenta MCP, nova etapa do workflow, novo template em `templates/tech-specs/` ou nova regra for introduzida na skill `agy-ensemble`, o arquivo [`README.md`](../README.md) da raiz da skill DEVE ser imediatamente atualizado em sincronia.
   - O teste automatizado de integridade [`test/readme-sync-gate.test.ts`](../test/readme-sync-gate.test.ts) valida se todas as ferramentas do ensemble e todas as 12 etapas do workflow constam descritas no `README.md`.
