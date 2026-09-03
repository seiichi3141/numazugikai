import { describe, expect, it } from "vitest";
import { prioritizePrimaryEvidence } from "./prioritize-primary-evidence";

describe("prioritizePrimaryEvidence", () => {
  it("一次資料を補足資料より先にし、同じ役割はID順にする", () => {
    expect(
      prioritizePrimaryEvidence([
        { id: "b", role: "supplementary" as const },
        { id: "c", role: "primary" as const },
        { id: "a", role: "primary" as const },
      ])
    ).toEqual([
      { id: "a", role: "primary" },
      { id: "c", role: "primary" },
      { id: "b", role: "supplementary" },
    ]);
  });

  it("入力配列を変更しない", () => {
    const evidence = [
      { id: "b", role: "supplementary" as const },
      { id: "a", role: "primary" as const },
    ];

    prioritizePrimaryEvidence(evidence);

    expect(evidence.map((row) => row.id)).toEqual(["b", "a"]);
  });
});
