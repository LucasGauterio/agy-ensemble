# Technical Specification: LGPD & Privacy Specification (Mandato NFR-0)

> [!IMPORTANT]
> **Mandato NFR-0 Inegociável — Lei Geral de Proteção de Dados (Lei nº 13.709/2018)**
> Em conformidade estrita com a legislação brasileira de proteção de dados, 100% dos projetos desenvolvidos devem especificar, implementar e auditar os controles técnicos abaixo, independente do que for solicitado na requisição inicial do usuário.

---

## 1. ROPA — Registro das Operações de Tratamento (Art. 37 LGPD)

Toda entidade ou dado que processe informações de pessoa natural identificada ou identificável deve constar no ROPA:

| Campo / Dado Pessoal | Categoria (Comum / Sensível) | Finalidade do Tratamento | Base Legal (Art. 7º / 11) | Retenção / Expurgo | Mecanismo de Armazenamento |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cpf` | Comum | Identificação unívoca fiscal/financeira | Art. 7º, II (Cumprimento de Obrigação Legal) | 5 anos pós-encerramento | Vault Transit `AES-256-GCM` + Blind Index HMAC |
| `nome_completo` | Comum | Qualificação do titular para execução de contrato | Art. 7º, V (Execução de Contrato) | Duração do contrato | Texto cifrado no banco |
| `email` | Comum | Comunicação operacional e autenticação | Art. 7º, V (Execução de Contrato) | Duração do contrato | Vault Transit `AES-256-GCM` + Blind Index HMAC |
| `telefone` | Comum | Canal de alerta e recuperação de conta | Art. 7º, V (Execução de Contrato) | Duração do contrato | Vault Transit `AES-256-GCM` |
| `dados_biometricos` | Sensível | Prevenção a fraude e autenticação biométrica | Art. 11, II, g (Prevenção à Fraude) | Expurgo após validação | Hash irreversível / Keyvault HSM |

---

## 2. Direitos do Titular (Art. 18 LGPD)

A arquitetura DEVE expor ou garantir os seguintes fluxos determinísticos:

1. **Art. 18, I e II — Confirmação de Existência e Acesso:**
   - Endpoint ou serviço seguro para emitir relatório completo de todos os dados atrelados ao titular.
2. **Art. 18, III — Correção de Dados Incompletos, Inexatos ou Desatualizados:**
   - Mutação idempotente com atualização automática de blind indexes atrelados.
3. **Art. 18, IV e VI — Anonimização, Bloqueio ou Eliminação (Direito ao Esquecimento):**
   - **Crypto-Shredding:** Destruição irreversível da chave de criptografia do titular no Vault Transit, tornando todos os registros históricos indecifráveis em backups e bancos.
   - **Expurgo em Cascata:** Limpeza síncrona/assíncrona de chaves em Redis Cache (`DEL user:{id}:*`), RabbitMQ mensagens não processadas e invalidação de sessões ativas.
4. **Art. 18, V — Portabilidade dos Dados:**
   - Exportação em formato aberto padronizado (`application/json`) assinado digitalmente.
5. **Art. 18, IX — Revogação do Consentimento:**
   - Registro atômico no `ConsentLedger` e bloqueio imediato de tratamentos baseados em consentimento livre.

---

## 3. Criptografia em Repouso, em Trânsito e Blind Indexes

- **Em Trânsito:** TLS 1.3 obrigatório para todas as comunicações externas e mTLS entre microsserviços internos.
- **Em Repouso (Campos Sensíveis):** Encriptação no nível de aplicação utilizando Vault Transit Engine com cifra autenticada `AES-256-GCM` (Envelope Encryption).
- **Blind Index (Busca Determinística):** Para permitir consultas exatas (como buscar por CPF ou e-mail sem decifrar o banco inteiro), utiliza-se `HMAC-SHA256(salt_secreto, dado_normalizado)`. O salt é injetado via Vault e nunca armazenado na mesma tabela dos dados cifrados.

---

## 4. ConsentLedger — Trilha Imutável de Auditoria de Consentimentos

Toda concessão, alteração ou revogação de consentimento deve ser gravada em tabela append-only imutável:

```sql
CREATE TABLE IF NOT EXISTS consent_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id VARCHAR(255) NOT NULL,
  purpose VARCHAR(100) NOT NULL,
  legal_basis VARCHAR(50) NOT NULL, -- ex: 'Art. 7, I'
  granted BOOLEAN NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT NOT NULL,
  policy_version VARCHAR(20) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consent_subject ON consent_ledger(subject_id);
```

---

## 5. Sanitização Estruturada de Logs (`[LGPD_REDACTED]`)

- É terminantemente proibido gravar dados pessoais em logs de aplicação (Pino, Winston, Zap) ou métricas.
- Máscara de sanitização automática ativada:
  - CPF: `\d{3}\.\d{3}\.\d{3}\-\d{2}` ou `\d{11}` → `[LGPD_REDACTED]`
  - CNPJ: `\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}` ou `\d{14}` → `[LGPD_REDACTED]`
  - RG: `\d{1,2}\.\d{3}\.\d{3}\-[\dX]` → `[LGPD_REDACTED]`
  - E-mail: `[\w\.-]+@[\w\.-]+\.\w+` → `[LGPD_REDACTED]`
  - Telefone / Celular: `(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}|\d{4})[-\s]?\d{4}` → `[LGPD_REDACTED]`
  - Senhas, tokens, Bearer headers, cartões de crédito e chaves PIX → `[LGPD_REDACTED]`
- Parâmetros de consulta (Query Strings) em requisições HTTP GET nunca devem transportar PII em URLs limpas.
