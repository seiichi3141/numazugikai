import { describe, expect, it } from "vitest";
import type { GeneralQuestionSession } from "../types/general-question";
import { buildGeneralQuestionVisualization } from "./build-general-question-visualization";

describe("buildGeneralQuestionVisualization", () => {
  it("同じ登壇枠の項目数と答弁者数で共起件数を水増ししない", () => {
    const sessions = [
      {
        id: "session",
        name: "令和8年9月定例会",
        slug: "r8-9",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        coverage: [],
        classificationRelease: { id: "release", taxonomyVersion: "v1" },
        appearances: [
          {
            id: "appearance",
            meetingId: "meeting",
            heldOn: "2026-09-03",
            meetingStatus: "held",
            meetingTitle: "本会議",
            speakerName: "議員",
            seatNumber: 1,
            questionOrder: 1,
            questionKind: "personal",
            deliveryMethod: "one_by_one",
            sourceUrl: null,
            sourceFetchedAt: null,
            items: [
              {
                id: "item-1",
                parentItemId: null,
                order: 1,
                summary: "防災",
                summaryGenerationModel: "openai/gpt-5-mini",
                summaryPromptVersion: "2026-09-04-v1",
                topics: [{ id: "disaster", slug: "disaster", label: "防災" }],
              },
              {
                id: "item-2",
                parentItemId: "item-1",
                order: 1,
                summary: "避難",
                summaryGenerationModel: "openai/gpt-5-mini",
                summaryPromptVersion: "2026-09-04-v1",
                topics: [{ id: "disaster", slug: "disaster", label: "防災" }],
              },
            ],
            answerers: [
              {
                id: "a1",
                personName: "A",
                roleName: "部長",
                roleGroup: "department_head",
              },
              {
                id: "a2",
                personName: "B",
                roleName: "別の部長",
                roleGroup: "department_head",
              },
            ],
          },
        ],
      },
    ] satisfies GeneralQuestionSession[];
    const result = buildGeneralQuestionVisualization(sessions);
    expect(result.topics[0]).toMatchObject({
      itemCount: 1,
      appearanceCount: 1,
    });
    expect(result.cooccurrences).toEqual([
      {
        topicId: "disaster",
        topicLabel: "防災",
        roleGroup: "department_head",
        appearanceCount: 1,
      },
    ]);
  });
});
