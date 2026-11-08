# Diretrizes da Arquitetura MVC Alvo

Ao refatorar os projetos legados, a seguinte estrutura organizacional de diretórios deve ser aplicada:

```
src/
├── config/
│   └── database.js / settings.py    # Configurações globais e inicialização de conexão do banco
├── models/
│   └── <dominio_model>.js / .py     # Abstração de dados, definição de esquemas, consultas parametrizadas
├── controllers/
│   └── <dominio_controller>.js / .py# Regras de fluxo, lógica de negócios do caso de uso, chamadas de serviço
├── views/ (ou routes/)
│   └── <dominio_routes>.js / .py    # Mapeamento de rotas de API, escuta de HTTP, validação básica de input
├── middlewares/
│   └── error_handler.js / .py       # Tratador centralizado de exceções / erros da API
└── app.js / app.py                  # Entrypoint limpo (Composition Root), inicializa o servidor
```

## Responsabilidades de Cada Camada

### 1. Config (`src/config/`)
- Não deve conter segredos de infraestrutura chumbados. Deve ler de variáveis de ambiente (`process.env` no Node ou `os.environ` no Python).
- Inicializa pools de conexões com o banco de dados.

### 2. Models (`src/models/`)
- Contém a lógica de acesso e mapeamento de dados (ex: classes SQLAlchemy ou funções SQLite parametrizadas).
- Não deve conter lógica de resposta HTTP (como chamadas `jsonify` ou `res.send`).
- Deve usar apenas Prepared Statements / consultas parametrizadas.

### 3. Controllers (`src/controllers/`)
- Orquestra os fluxos de dados requisitados, invocando Models ou Services.
- Contém regras de negócio complexas.
- Formata a saída que será retornada, interagindo com o protocolo HTTP.

### 4. Views / Routes (`src/views/` ou `src/routes/`)
- Mapeia endpoints HTTP (GET, POST, PUT, DELETE) às funções de controlador correspondentes.
- Realiza validação de presença e tipos primitivos de dados de entrada antes de repassar ao controlador.

### 5. Middlewares (`src/middlewares/`)
- Processa fluxos transversais (Cross-cutting Concerns).
- Intercepta erros inesperados para retornar respostas padronizadas `500 Internal Server Error` sem vazar logs e segredos internos.
