import { describe, expect, it } from "vitest";
import { generateGeneralQuestionSummaries } from "./generate-general-question-summaries";

describe("generateGeneralQuestionSummaries", () => {
  it("uses the injected generator and validates its output", async () => {
    const result = await generateGeneralQuestionSummaries({
      councilName: "沼津市議会",
      speakerName: "沼津 花子",
      items: [
        { sourceKey: "item-1", label: "防災について", parentSourceKey: null },
      ],
      generator: async ({ prompt }) => {
        expect(prompt).toContain("防災について");
        return [{ sourceKey: "item-1", summary: "地域防災の取組" }];
      },
    });
    expect(result).toEqual({ "item-1": "地域防災の取組" });
  });
});
