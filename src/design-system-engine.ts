export interface ScreenInventoryResult {
  requiresFigmaUrl: false
  classifications: string[]
  lgpdPrivacyPrimitiveIncluded: boolean
  newOrExtendedPaths: string[]
}

/**
 * Build a Code-First Screen Inventory without requiring Figma URLs,
 * classifying components into reuse (<path>), extend (<path> (extend: ...)), or new (<path> (new)),
 * and automatically including LGPD Privacy & Consent UI primitives.
 */
export function buildCodeFirstScreenInventory(input: {
  phaseNumber: string
  existingComponents: string[]
  requestedComponents: Array<{
    name: string
    mode: "reuse" | "extend" | "new"
    path: string
    extensionNote?: string
  }>
}): ScreenInventoryResult {
  const classifications: string[] = []
  const newOrExtendedPaths: string[] = []

  for (const item of input.requestedComponents) {
    if (item.mode === "reuse") {
      classifications.push(item.path)
    } else if (item.mode === "extend") {
      classifications.push(`${item.path} (extend: ${item.extensionNote ?? "enhance variant"})`)
      newOrExtendedPaths.push(item.path)
    } else {
      classifications.push(`${item.path} (new)`)
      newOrExtendedPaths.push(item.path)
    }
  }

  // Always ensure LGPD Consent & Privacy Center UI primitive is included (Privacy by Default)
  const lgpdBannerPath = "src/components/ui/lgpd-consent-banner.tsx"
  if (!classifications.some((c) => c.includes(lgpdBannerPath))) {
    classifications.push(`${lgpdBannerPath} (new)`)
    newOrExtendedPaths.push(lgpdBannerPath)
  }

  return {
    requiresFigmaUrl: false,
    classifications,
    lgpdPrivacyPrimitiveIncluded: true,
    newOrExtendedPaths,
  }
}

/**
 * Synthesize Wave Zero step SI-NN.0.1 for Design System tokens and shared UI primitives
 * so parallel feature teammates never collide on shared UI components.
 */
export function synthesizeWaveZeroDesignSystemStep(
  phaseNumber: string,
  inventory: ScreenInventoryResult,
): {
  siId: string
  title: string
  filesTouched: string[]
} {
  return {
    siId: `SI-${phaseNumber}.0.1`,
    title: "Code-First Design System Tokens, Shared UI Primitives & LGPD Consent UI",
    filesTouched: [
      "docs/DESIGN_SYSTEM.md",
      "src/styles/globals.css",
      ...inventory.newOrExtendedPaths,
    ],
  }
}
