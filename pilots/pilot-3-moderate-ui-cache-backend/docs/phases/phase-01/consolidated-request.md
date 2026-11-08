## Requisição Consolidada Oficial (Fonte Única de Verdade — Substitui a Solicitação Inicial)

> **Solicitação Original (Histórico):** Crie um portal de telemedicina com dashboard em tempo real, cache de sessão e rate limiting.

### Decisões Consolidadas (Zero Presunções Abertas)
- **Para eliminar presunções sobre "Stack Tecnológica e Ecossistema Principal", qual abordagem devemos adotar no projeto?:** (Recommended) Padrão Sinérgico agy-ensemble para Stack Tecnológica e Ecossistema Principal (Alta coesão, baixo TCO e deploy automatizado)
- **Para eliminar presunções sobre "Provedor de Nuvem Produtiva e Estratégia de Deploy (GitHub Actions)", qual abordagem devemos adotar no projeto?:** (Recommended) Padrão Sinérgico agy-ensemble para Provedor de Nuvem Produtiva e Estratégia de Deploy (GitHub Actions) (Alta coesão, baixo TCO e deploy automatizado)
- **Para eliminar presunções sobre "Integrações Externas e Provedores de Pagamento / Mensageria", qual abordagem devemos adotar no projeto?:** (Recommended) Padrão Sinérgico agy-ensemble para Integrações Externas e Provedores de Pagamento / Mensageria (Alta coesão, baixo TCO e deploy automatizado)
- **Para eliminar presunções sobre "Volumetria Esperada (Seed / Growth / Scale) e Teto de Custo Cloud (TCO)", qual abordagem devemos adotar no projeto?:** (Recommended) Padrão Sinérgico agy-ensemble para Volumetria Esperada (Seed / Growth / Scale) e Teto de Custo Cloud (TCO) (Alta coesão, baixo TCO e deploy automatizado)
- **Para eliminar presunções sobre "Modelo de Autenticação, Autorização (RBAC/Multi-Tenant) e Escopo de Dados", qual abordagem devemos adotar no projeto?:** (Recommended) Padrão Sinérgico agy-ensemble para Modelo de Autenticação, Autorização (RBAC/Multi-Tenant) e Escopo de Dados (Alta coesão, baixo TCO e deploy automatizado)

### Mandato NFR-0 Implícito Obrigatório
- **Compliance Obrigatório LGPD (Lei nº 13.709/2018):** Privacy by Design & Default, ROPA, Direitos do Titular Art. 18 (Portabilidade + Anonimização Irreversível / Crypto-Shredding), Criptografia de Coluna via Vault Transit + Blind Index HMAC-SHA256 e Consent Ledger.
- **Segurança, Logs e Observabilidade:** Gitleaks em 3 camadas, Vault Secret & Config Server, Logger JSON estruturado com Redaction brasileira (`[LGPD_REDACTED]`), OpenTelemetry e Quality Gates (Sonar + SAST + DAST + PenTests).