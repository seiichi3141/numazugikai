import { describe, expect, it } from "vitest";
import {
  generalQuestionsToCsv,
  type OpenDataGeneralQuestionItem,
} from "./get-open-data-general-questions";

describe("generalQuestionsToCsv", () => {
  it("AI要約のモデルとプロンプト版を重複なくCSVへ出力する", () => {
    const item: OpenDataGeneralQuestionItem = {
      appearanceId: "appearance-1",
      meetingId: "meeting-1",
      session: { id: "session-1", slug: "2026-13", name: '令和8年"第13回"' },
      heldOn: "2026-09-04",
      questionOrder: 1,
      questionKind: "personal",
      deliveryMethod: "one_by_one",
      speakerName: "検証議員",
      seatNumber: 9,
      items: [
        {
          id: "item-1",
          parentItemId: null,
          order: 1,
          summary: "防災対策",
          summaryGenerationModel: "openai/gpt-5-mini",
          summaryPromptVersion: "2026-09-04-v1",
          topics: [],
        },
        {
          id: "item-2",
          parentItemId: "item-1",
          order: 1,
          summary: "避難所整備",
          summaryGenerationModel: "openai/gpt-5-mini",
          summaryPromptVersion: "2026-09-04-v1",
          topics: [],
        },
      ],
      answerers: [],
      sourceUrl: "https://example.com/source.pdf",
      sourceFetchedAt: "2026-09-04T00:00:00.000Z",
      qaStatus: "verified",
      classificationRelease: null,
      coverage: [],
    };

    const csv = generalQuestionsToCsv([item]);

    expect(csv.split("\n")[0]).toContain('"summary_generation_models"');
    expect(csv.split("\n")[0]).toContain('"summary_prompt_versions"');
    expect(csv).toContain('"openai/gpt-5-mini","2026-09-04-v1"');
    expect(csv).not.toContain("openai/gpt-5-mini|openai/gpt-5-mini");
    expect(csv).toContain('"令和8年""第13回"""');
  });
});
