// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GeneralQuestionSessionPage } from "./general-question-session-page";

vi.mock("../loaders/get-general-question-sessions", () => ({
  getGeneralQuestionSessionBySlug: async () => ({
    id: "session-1",
    name: "令和8年6月定例会",
    slug: "2026-2",
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    classificationRelease: { id: "release-1", taxonomyVersion: "v1" },
    coverage: [],
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
        items: [],
        answerers: [
          {
            id: "answerer-1",
            personName: "市長",
            roleName: "市長および長い役職名の表示確認",
            roleGroup: "mayor",
          },
        ],
      },
    ],
  }),
}));

describe("GeneralQuestionSessionPage", () => {
  it("会期と出典の日付を日本時間の表示へ整形する", async () => {
    render(await GeneralQuestionSessionPage({ slug: "2026-2" }));

    expect(
      screen.getByRole("heading", { name: "令和8年6月定例会の一般質問" })
    ).toBeInTheDocument();
    expect(screen.getByText("2026年6月1日〜2026年6月30日")).toBeInTheDocument();
    expect(screen.getByText(/2026年6月15日・実績/)).toBeInTheDocument();
    expect(screen.getByText("取得日時: 2026/9/4 09:00")).toBeInTheDocument();
    expect(screen.getByText("市長および長い役職名の表示確認")).toHaveClass(
      "max-w-full",
      "whitespace-normal"
    );
  });
});
