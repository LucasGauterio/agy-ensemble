---
name: design-docs-adr
description: >-
  Escreve os ADRs (Architecture Decision Records, formato MADR) das decisões
  arquiteturais fechadas do sistema. Produz arquivos em docs/adrs/ADR-NNN-titulo-kebab.md.
  Skill obrigatória do workflow design-docs; roda após design-docs-prd e design-docs-rfc.
  NUNCA PODE SER IGNORADA OU PULADA.
---

# design-docs-adr: ADRs das decisões arquiteturais

## 🛑 Regra Absoluta de Não-Pulo (No-Skip Mandate)

> ⚠️ **NUNCA PULE ESTA SKILL**: O agente está STRICTLY PROIBIDO de pular `design-docs-adr` sob qualquer justificativa.
> Justificativas como *"o template é para backend SQL/DLQ"*, *"é uma SPA cliente"*, ou *"não há decisão nova"* são **STRICTLY INVÁLIDAS**.
> Se a fase/feature não introduz um padrão arquitetural inédito, a skill MUST ainda ser executada para documentar a **avaliação arquitetural e reuso explícito de padrões** (referenciando os ADRs existentes como ADR-001/ADR-002 e símbolos reais do código com âncoras `#Lnn`).

---

## Insumos

- `docs/project-plan.md` ou transcrição/decisões da fase.
- `.claude/references/architecture/adr.md` (formato MADR adaptável ao stack).
- `docs/PRD.md`, `docs/RFC.md` e arquivos de código em `src/`.
- ADRs existentes em `docs/adrs/`.

## Passos

1. **Mapeamento de Categorias Arquiteturais (Adaptável ao Stack)**:
   Selecione as decisões arquiteturais relevantes para o stack real da aplicação:
   - **Persistência & Armazenamento**: SQL/NoSQL no backend OR IndexedDB/LocalStorage com criptografia no frontend SPA.
   - **Segurança & Criptografia**: JWT/OAuth2 no backend OR Web Crypto API (PBKDF2 / AES-GCM) no cliente.
   - **Separação de Lógica de Negócio**: Camada de serviço DDD no backend OR módulos de serviços JS/TS puros no frontend.
   - **Comunicação & Reatividade**: REST/GraphQL/Filas no backend OR Hooks reativos / i18n / Web Workers no frontend.
   - **Tolerância a Falhas**: Retries/Backoff/DLQ no backend OR Fallbacks reativos e limites de UI no frontend.
   - **Reuso de Padrões Existentes**: Avaliação de conformidade com ADRs pré-existentes (`ADR-001`, `ADR-002`) e regras do projeto.

2. **Geração ou Atualização de ADR**:
   - Nome: `docs/adrs/ADR-NNN-titulo-kebab.md`.
   - Se for reuso de padrões existentes, gere o ADR documentando a garantia de reuso e cite símbolos reais do código (`src/...#Lnn`).

3. **Formato MADR (7 seções)**:
   - Header enxuto: Status, Data, Decisões relacionadas.
   - Seções: Contexto e problema, Decisão, Alternativas consideradas (≥ 1), Consequências (positivas e negativas), Referências.

4. **Links de Arquivo (Regra `repo-file-links.md`)**:
   - Na seção Referências, use **links relativos com âncora de linha `#Lnn`** a partir de `docs/adrs/` (`../../src/...#Lnn`).
   - Links para RFC (`../RFC.md`) e outros ADRs (`ADR-00X-*.md`).

## Saída

`docs/adrs/ADR-001-*.md` … `docs/adrs/ADR-NNN-*.md`. Manter o `docs/adrs/README.md`.
