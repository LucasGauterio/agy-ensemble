import { describe, expect, test } from "bun:test";
import {
	buildInterviewRoundBatch,
	detectOpenAssumptions,
	synthesizeConsolidatedOfficialRequest,
} from "../src/interview-engine";

describe("IMP-05 / VAL-05: Etapa 1.0 Iterative Assumption Interview & Consolidated Request", () => {
	test("detects open assumptions in a vague prompt, batches 3-5 questions per ask_question turn with (Recommended) first, and synthesizes Consolidated Official Request replacing initial prompt", () => {
		const initialVaguePrompt =
			"Crie um sistema de pagamentos e assinaturas para clínicas.";
		const assumptions = detectOpenAssumptions(initialVaguePrompt);

		expect(assumptions.length).toBeGreaterThanOrEqual(4);

		// First round batch must contain between 3 and 5 questions, each with (Recommended) first
		const batch1 = buildInterviewRoundBatch(assumptions);
		expect(batch1.questions.length).toBeGreaterThanOrEqual(3);
		expect(batch1.questions.length).toBeLessThanOrEqual(5);
		for (const q of batch1.questions) {
			expect(q.options[0]?.startsWith("(Recommended)")).toBe(true);
		}

		// Error path: attempting to synthesize while assumptions remain unresolved must throw
		expect(() =>
			synthesizeConsolidatedOfficialRequest({
				initialPrompt: initialVaguePrompt,
				unresolvedAssumptions: ["Qual gateway de pagamento?"],
				resolvedDecisions: {},
			}),
		).toThrow(
			/Cannot synthesize Consolidated Official Request while 1 assumption\(s\) remain unresolved/,
		);

		// Happy path: all assumptions resolved -> generates Consolidated Official Request that replaces raw prompt
		const consolidated = synthesizeConsolidatedOfficialRequest({
			initialPrompt: initialVaguePrompt,
			unresolvedAssumptions: [],
			resolvedDecisions: {
				stack: "NestJS + Next.js + PostgreSQL + Redis",
				cloudTarget: "Google Cloud Run + Cloudflare + GitHub Actions",
				paymentGateway: "Stripe + PIX Banco Central",
				volumetryTier: "Seed (1k MAU) -> Growth (25k MAU)",
			},
		});

		expect(consolidated.replacesInitialPrompt).toBe(true);
		expect(consolidated.markdown).toContain(
			"## Requisição Consolidada Oficial",
		);
		expect(consolidated.markdown).toContain(
			"Compliance Obrigatório LGPD (Lei nº 13.709/2018)",
		);
		expect(consolidated.markdown).toContain(
			"Google Cloud Run + Cloudflare + GitHub Actions",
		);
	});
});
