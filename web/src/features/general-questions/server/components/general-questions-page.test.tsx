// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GeneralQuestionsPage } from "./general-questions-page";

vi.mock("../loaders/get-general-question-sessions", () => ({
  getGeneralQuestionSessions: async () => [
    {
      id: "session-1",
      name: "令和8年6月定例会",
      slug: "2026-2",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      classificationRelease: { id: "release-1", taxonomyVersion: "v1" },
      coverage: [
        {
          sourceKind: "general_question_pdf",
          state: "collected",
          recordPresence: "present",
          disposition: "held",
          expectedCount: 1,
          matchedCount: 1,
          checkedAt: "2026-09-04T00:00:00Z",
        },
      ],
      appearances: [
        {
          id: "appearance-1",
          meetingId: "meeting-1",
          heldOn: "2026-06-15",
          meetingStatus: "held",
          meetingTitle: "本会議",
          speakerName: "検証議員",
          seatNumber: 1,
          questionOrder: 1,
          questionKind: "personal",
          deliveryMethod: "one_by_one",
          sourceUrl: "https://example.com/official.pdf",
          sourceFetchedAt: "2026-09-04T00:00:00Z",
          items: [
            {
              id: "item-1",
              parentItemId: null,
              order: 1,
              summary: "防災について",
              summaryGenerationModel: "openai/gpt-5-mini",
              summaryPromptVersion: "2026-09-04-v1",
              topics: [
                {
                  id: "topic-1",
                  slug: "disaster-safety",
                  label: "防災・危機管理",
                },
              ],
            },
          ],
          answerers: [
            {
              id: "answerer-1",
              personName: "市長",
              roleName: "市長",
              roleGroup: "mayor",
            },
          ],
        },
      ],
    },
  ],
}));

describe("GeneralQuestionsPage", () => {
  it("フィルター、読み上げ件数、グラフ同値表、出典を表示する", async () => {
    render(await GeneralQuestionsPage({ filters: {} }));
    expect(
      screen.getByRole("heading", { name: "一般質問" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("政策分野")).toBeInTheDocument();
    expect(screen.getByLabelText("開催年（西暦）")).toBeInTheDocument();
    expect(screen.getByLabelText("答弁者役職")).toBeInTheDocument();
    expect(screen.getByText("1件の登壇枠")).toHaveAttribute(
      "aria-live",
      "polite"
    );
    expect(screen.getByText("一般質問資料（PDF）")).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: /政策分野ごとの質問項目数/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /公式資料/ })).toHaveAttribute(
      "href",
      "https://example.com/official.pdf"
    );
    expect(screen.getByText(/本サービスは非公式/)).toBeInTheDocument();
  });

  it("登壇枠の絞り込みで0件になった会期を表示しない", async () => {
    render(
      await GeneralQuestionsPage({
        filters: { questionKind: "representative" },
      })
    );

    expect(screen.getByText("0件の登壇枠")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "令和8年6月定例会" })
    ).not.toBeInTheDocument();
  });
});
