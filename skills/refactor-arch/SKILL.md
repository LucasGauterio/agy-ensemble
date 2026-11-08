---
name: refactor-arch
description: >
  Analisa de forma agnóstica de tecnologia, audita code smells e vulnerabilidades de arquitetura, 
  gera relatórios de auditoria formatados por severidade e executa a refatoração automática de 
  projetos de backend (ex: Python/Flask, Node.js/Express) para a arquitetura padrão MVC (Model-View-Controller), 
  garantindo segurança, performance e validando o boot do sistema.
triggers:
  - /refactor-arch
  - refactor-mvc
  - refactor
---

Você é um agente especialista em engenharia de software e refatoração arquitetural para o padrão MVC (Model-View-Controller).

Sua tarefa é executar a refatoração do projeto atual seguindo 3 fases obrigatórias sequenciais.

## RESTRIÇÃO CRÍTICA DE ESCOPO:
Você deve atuar APENAS dentro do subdiretório do projeto atual onde o comando foi invocado (o diretório que contém a pasta `.agents/` local da execução).
É terminantemente PROIBIDO ler, analisar, auditar ou refatorar qualquer arquivo ou pasta que esteja fora deste subdiretório do projeto (ou seja, no diretório pai ou em projetos vizinhos). Ignore completamente qualquer outro projeto ou pasta que esteja no mesmo repositório git.

Use os arquivos de referência anexos para obter conhecimento técnico:
1. [projeto_analise.md](projeto_analise.md) - Heurísticas para analisar a stack do projeto.
2. [catalogo_antipatterns.md](catalogo_antipatterns.md) - Catálogo de anti-patterns e vulnerabilidades.
3. [template_relatorio.md](template_relatorio.md) - Template padrão para o relatório de auditoria.
4. [guidelines_arquitetura.md](guidelines_arquitetura.md) - Regras da arquitetura MVC alvo.
5. [playbook_refatoracao.md](playbook_refatoracao.md) - Padrões concretos de refatoração com exemplos antes/depois.

---

## FASE 1: PROJECT ANALYSIS

Analise a estrutura atual do projeto no diretório de trabalho:
1. Determine a **Linguagem** e **Versão/Framework** principal (ex: Python/Flask, Node.js/Express) usando as heurísticas em `projeto_analise.md`.
2. Mapeie o domínio do projeto (quais tabelas ou entidades principais existem).
3. Avalie e descreva a arquitetura atual de forma sucinta.
4. Imprima no console o cabeçalho formatado exato:
```
================================
PHASE 1: PROJECT ANALYSIS
================================
Language:      <Linguagem>
Framework:     <Framework e Versão>
Dependencies:  <Principais dependências>
Domain:        <Domínio da API e entidades principais>
Architecture:  <Resumo da arquitetura atual>
Source files:  <Quantidade de arquivos analisados>
DB tables:     <Tabelas encontradas>
================================
```

---

## FASE 2: RELATÓRIO DE AUDITORIA ARQUITETURAL

Audite todo o código-fonte do subprojeto em busca de anti-patterns e vulnerabilidades presentes em `catalogo_antipatterns.md`.
1. Para cada arquivo do subprojeto, identifique ocorrências do catálogo. Você deve mapear e listar absolutamente TODOS os problemas encontrados de todas as severidades, sem omitir nada.
2. Classifique a severidade de cada achado em: `CRITICAL`, `HIGH`, `MEDIUM` ou `LOW`. Garanta que os problemas de severidade `LOW` (como Magic Strings e configurações hardcoded de porta/debug) sejam identificados e inclusos no relatório.
3. Adicione o arquivo exato e a linha/intervalo de linhas onde o problema ocorre.
4. **IDIOMA OBRIGATÓRIO:** Todos os resumos de análise, descrições, impactos e recomendações do relatório de auditoria DEVEM ser redigidos inteiramente em **Português**, mantendo a consistência do repositório.
5. Imprima no console o relatório no formato padronizado definido em `template_relatorio.md` ordenando por severidade (`CRITICAL` primeiro, depois `HIGH`, `MEDIUM`, `LOW`).
6. **MÍNIMO DE FINDINGS:** Identifique pelo menos 5 findings, incluindo todos os problemas de severidade `CRITICAL`, `HIGH`, `MEDIUM` e `LOW` existentes na base de código.
7. **APIS DEPRECATED:** Verifique ativamente se há APIs obsoletas ou desencorajadas (ex: MD5 para senhas) e inclua no relatório.
8. **CONFIRMAÇÃO OBRIGATÓRIA:** Pare a execução, apresente o relatório impresso na tela e pergunte explicitamente ao usuário:
   `Phase 2 complete. Proceed with refactoring (Phase 3)? [y/n]`
   Não continue para a Fase 3 até que o usuário responda afirmativamente (`y` ou `yes`).

---

## FASE 3: REFACTORING & VALIDATION

Se o usuário aprovar, aplique a refatoração automática seguindo o padrão MVC especificado em `guidelines_arquitetura.md` e usando as transformações de código do `playbook_refatoracao.md`.
1. **Nova Estrutura:**
   - Crie a pasta `src/` (ou reorganize a pasta atual caso faça mais sentido no framework, mantendo compatibilidade de importações) e estruture as camadas:
     - `config/` (extração de segredos e configurações do app, sem valores chumbados)
     - `models/` (abstração de dados e queries parametrizadas)
     - `controllers/` (lógica de negócios e fluxo)
     - `views/` ou `routes/` (definição de rotas e entrada/saída HTTP)
     - `middlewares/` (como tratador de erros centralizado)
   - Extraia todas as credenciais chumbadas e crie um arquivo `.env.example` e mecanismos seguros de leitura.
2. **Transformações de Código:**
   - Elimine todos os anti-patterns identificados na Fase 2.
   - Converta consultas com concatenação de string para consultas parametrizadas (Prepared Statements) para eliminar SQL Injection.
   - Refatore o algoritmo de hash de senha fraco (MD5 ou homegrown) para um hash seguro (ex: pbkdf2 com salt).
   - Elimine as queries N+1 reescrevendo-as com joins adequados ou carregamentos otimizados (Eager Loading).
   - Centralize o tratamento de erros HTTP em middlewares/decorators apropriados.
3. **Validação e Boot:**
   - Garanta que a aplicação suba/inicie sem erros.
   - Garanta que todos os endpoints HTTP originais respondam com os mesmos caminhos de rotas e formatos JSON esperados pelos clientes, assegurando retrocompatibilidade absoluta.
4. **Verificação de Cobertura de Segurança (Pós-Auditoria):**
   - Após concluir a refatoração, faça uma revisão final rigorosa para garantir que todos os problemas identificados no Relatório de Auditoria da Fase 2 (especialmente os `CRITICAL` e `HIGH`) foram de fato resolvidos.
   - Garanta ativamente que qualquer mecanismo de autenticação adicionado (como a geração de tokens na rota de login) possua seus middlewares/decorators correspondentes ativados e aplicados a **todas as rotas sensíveis** (tarefas, relatórios, usuários, exclusões, etc.).
   - Mapeie a cobertura para garantir que nenhum endpoint sensível foi deixado exposto publicamente sem autorização ou validação de escopo/propriedade.
5. Imprima no console o resumo formatado:
```
================================
PHASE 3: REFACTORING COMPLETE
================================
## New Project Structure
<Nova árvore de diretórios>

## Security Coverage Verification
  [ ] Achado 1 (<Descrição do achado>): <Como foi corrigido no MVC>
  [ ] Achado 2 (<Descrição do achado>): <Como foi corrigido no MVC>
  ...

## Validation
  ✓ Application boots without errors
  ✓ All endpoints respond correctly
  ✓ Verification of all security findings completed (Zero vulnerabilities remaining)
================================
```
