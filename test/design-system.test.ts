import { describe, expect, test } from "bun:test"
import {
  buildCodeFirstScreenInventory,
  synthesizeWaveZeroDesignSystemStep,
} from "../src/design-system-engine"

describe("IMP-07 / VAL-07: Code-First Design System (No Figma) & Wave Zero Synthesis", () => {
  test("classifies UI components without Figma URLs, injects mandatory LGPD Privacy/Consent primitives, and isolates primitive creation in Wave Zero (SI-NN.0.1)", () => {
    const inventory = buildCodeFirstScreenInventory({
      phaseNumber: "01",
      existingComponents: ["src/components/ui/button.tsx", "src/components/ui/card.tsx"],
      requestedComponents: [
        { name: "button", mode: "reuse", path: "src/components/ui/button.tsx" },
        { name: "card", mode: "extend", path: "src/components/ui/card.tsx", extensionNote: "add status badge slot" },
        { name: "data-table", mode: "new", path: "src/components/ui/data-table.tsx" },
      ],
    })

    expect(inventory.requiresFigmaUrl).toBe(false)
    expect(inventory.classifications).toContain("src/components/ui/button.tsx")
    expect(inventory.classifications).toContain("src/components/ui/card.tsx (extend: add status badge slot)")
    expect(inventory.classifications).toContain("src/components/ui/data-table.tsx (new)")
    expect(inventory.lgpdPrivacyPrimitiveIncluded).toBe(true)

    const waveZero = synthesizeWaveZeroDesignSystemStep("01", inventory)
    expect(waveZero.siId).toBe("SI-01.0.1")
    expect(waveZero.filesTouched).toContain("docs/DESIGN_SYSTEM.md")
    expect(waveZero.filesTouched).toContain("src/components/ui/lgpd-consent-banner.tsx")
  })
})
