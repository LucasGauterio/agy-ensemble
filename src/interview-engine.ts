/**
 * Etapa 1.0: Detect open technical, product, cloud, and volumetry assumptions in a user prompt.
 */
export function detectOpenAssumptions(prompt: string): string[] {
	const lower = prompt.toLowerCase();
	const assumptions: string[] = [];

	if (!/(nestjs|fastify|express|fastapi|go|spring|next\.js|vite)/.test(lower)) {
		assumptions.push("Stack Tecnológica e Ecossistema Principal");
	}
	if (!/(gcp|google cloud|cloudflare|aws|azure)/.test(lower)) {
		assumptions.push(
			"Provedor de Nuvem Produtiva e Estratégia de Deploy (GitHub Actions)",
		);
	}
	if (!/(stripe|pagarme|mercadopago|pix|asaas|iugu)/.test(lower)) {
		assumptions.push(
			"Integrações Externas e Provedores de Pagamento / Mensageria",
		);
	}
	if (!/(mau|req\/s|volumetria|seed|growth|scale|usuários)/.test(lower)) {
		assumptions.push(
			"Volumetria Esperada (Seed / Growth / Scale) e Teto de Custo Cloud (TCO)",
		);
	}
	if (!/(rbac|abac|multitenant|multi-tenant|clínica|organização)/.test(lower)) {
		assumptions.push(
			"Modelo de Autenticação, Autorização (RBAC/Multi-Tenant) e Escopo de Dados",
		);
	}

	return assumptions;
}

/**
 * Build a single ask_question round batch of 3 to 5 multiple-choice questions,
 * always placing the Lead's recommended default first with the "(Recommended) " prefix.
 */
export function buildInterviewRoundBatch(assumptions: string[]): {
	questions: Array<{ question: string; options: string[] }>;
} {
	const slice = assumptions.slice(0, 5);
	const questions = slice.map((topic) => ({
		question: `Para eliminar presunções sobre "${topic}", qual abordagem devemos adotar no projeto?`,
		options: [
			`(Recommended) Padrão Sinérgico agy-ensemble para ${topic} (Alta coesão, baixo TCO e deploy automatizado)`,
			`Alternativa Minimalista / Serverless para ${topic}`,
			`Alternativa Enterprise / Dedicada para ${topic}`,
		],
	}));

	return { questions };
}

/**
 * Synthesize the Consolidated Official Request (Requisição Consolidada Oficial) once 100%
 * of assumptions are resolved. This document replaces the raw initial user prompt.
 */
export function synthesizeConsolidatedOfficialRequest(input: {
	initialPrompt: string;
	unresolvedAssumptions: string[];
	resolvedDecisions: Record<string, string>;
}): { replacesInitialPrompt: boolean; markdown: string } {
	if (input.unresolvedAssumptions.length > 0) {
		throw new Error(
			`Cannot synthesize Consolidated Official Request while ${input.unresolvedAssumptions.length} assumption(s) remain unresolved.`,
		);
	}

	const decisionLines = Object.entries(input.resolvedDecisions)
		.map(([k, v]) => `- **${k}:** ${v}`)
		.join("\n");

	const markdown = [
		"## Requisição Consolidada Oficial (Fonte Única de Verdade — Substitui a Solicitação Inicial)",
		"",
		`> **Solicitação Original (Histórico):** ${input.initialPrompt}`,
		"",
		"### Decisões Consolidadas (Zero Presunções Abertas)",
		decisionLines,
		"",
		"### Mandato NFR-0 Implícito Obrigatório",
		"- **Compliance Obrigatório LGPD (Lei nº 13.709/2018):** Privacy by Design & Default, ROPA, Direitos do Titular Art. 18 (Portabilidade + Anonimização Irreversível / Crypto-Shredding), Criptografia de Coluna via Vault Transit + Blind Index HMAC-SHA256 e Consent Ledger.",
		"- **Segurança, Logs e Observabilidade:** Gitleaks em 3 camadas, Vault Secret & Config Server, Logger JSON estruturado com Redaction brasileira (`[LGPD_REDACTED]`), OpenTelemetry e Quality Gates (Sonar + SAST + DAST + PenTests).",
	].join("\n");

	return {
		replacesInitialPrompt: true,
		markdown,
	};
}
