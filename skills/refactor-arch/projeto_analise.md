# Análise de Projeto — Heurísticas

Este documento define regras heurísticas para detectar a stack tecnológica e mapear a arquitetura atual do projeto sob análise.

## 1. Detecção de Stack Tecnológica

### Python / Flask
- **Presença de arquivos:** `app.py`, `wsgi.py`, `requirements.txt`.
- **Conteúdo de arquivos:**
  - Importação de `flask`, `Flask`, `Blueprint`, `jsonify`, `request` nos arquivos `.py`.
  - Dependências listadas no `requirements.txt` como `flask`, `Flask-SQLAlchemy`, `sqlite3`.

### Node.js / Express
- **Presença de arquivos:** `package.json`, `package-lock.json`, `app.js`, `server.js`, `index.js`.
- **Conteúdo de arquivos:**
  - `require('express')` ou `import express from 'express'`.
  - Scripts `npm start` ou `npm run dev` no `package.json`.

---

## 2. Detecção de Banco de Dados

- **SQLite:** Presença de arquivos `.db`, dependência de `sqlite3` no manifesto ou conexões em `:memory:`.
- **PostgreSQL / SQL/relational database:** Presença de dependências como `pg`, `SQL/relational database2`, `psycopg2` no manifesto.

---

## 3. Mapeamento de Arquitetura

Analise a estrutura de diretórios e o nível de separação de responsabilidades (camadas):
- **God Class / Monolito Sem MVC:** Todo o código de roteamento, lógica de negócio, consultas SQL brutas e controle de respostas está chumbado em um único arquivo (ex: `AppManager.js` ou `app.py`).
- **Arquitetura Parcialmente Separada:** Existe alguma pasta (`models/`, `routes/`, `services/`), mas sem tratamento centralizado de erros, injeção de dependências ou isolamento de segredos.
