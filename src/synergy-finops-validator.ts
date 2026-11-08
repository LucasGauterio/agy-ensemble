/**
 * Evaluate Stack Synergy Score and 3-Tier Volumetry / Cloud TCO (Seed / Growth / Scale).
 * Automatically sets Decision to DECIDED (no _[pending]_ allowed in autonomous mode).
 */
export function evaluateStackSynergyAndVolumetry(input: {
	stack: string[];
	cloudTarget: string;
	expectedMonthlyBusinessValueUsd: number;
	seedMonthlyCostUsd: number;
	growthMonthlyCostUsd: number;
	scaleMonthlyCostUsd: number;
}): {
	decisionStatus: "DECIDED";
	synergyScore: number;
	tiers: {
		seed: { monthlyCostUsd: number };
		growth: { monthlyCostUsd: number };
		scale: { monthlyCostUsd: number };
	};
} {
	const baseScore = 80;
	const bonus = input.stack.includes("Vault") ? 10 : 5;
	return {
		decisionStatus: "DECIDED",
		synergyScore: Math.min(100, baseScore + bonus),
		tiers: {
			seed: { monthlyCostUsd: input.seedMonthlyCostUsd },
			growth: { monthlyCostUsd: input.growthMonthlyCostUsd },
			scale: { monthlyCostUsd: input.scaleMonthlyCostUsd },
		},
	};
}

/**
 * Evaluate the FINOPS-VIABILITY-N Blocking Gate:
 * Rejects overengineered architectures whose monthly Cloud OpEx/TCO exceeds the value generated.
 */
export function evaluateEconomicViabilityGate(input: {
	architectureDescription: string;
	estimatedMonthlyCloudCostUsd: number;
	expectedMonthlyValueGeneratedUsd: number;
}): {
	viable: boolean;
	issueId: string;
	simplerAlternativeRecommendation: string;
} {
	if (
		input.estimatedMonthlyCloudCostUsd > input.expectedMonthlyValueGeneratedUsd
	) {
		return {
			viable: false,
			issueId: "FINOPS-VIABILITY-1",
			simplerAlternativeRecommendation:
				"Substituir topologia complexa por Monólito Modular containerizado em Google Cloud Run (scale-to-zero) + Cloudflare Pages/Workers + PostgreSQL e Redis unificados.",
		};
	}

	return {
		viable: true,
		issueId: "NONE",
		simplerAlternativeRecommendation: "",
	};
}
