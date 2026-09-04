// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { GeneralQuestionQaPage } from "./general-question-qa-page";

vi.mock("../actions/classify-general-question", () => ({
  classifyGeneralQuestion: vi.fn(),
  publishGeneralQuestionRelease: vi.fn(),
}));
vi.mock("../actions/generate-general-question-summaries", () => ({
  generateGeneralQuestionSummaryAction: vi.fn(),
}));
vi.mock("../actions/review-general-question", () => ({
  applyGeneralQuestion: vi.fn(),
  reviewGeneralQuestion: vi.fn(),
}));
vi.mock("../loaders/load-general-question-qa", () => ({
  loadGeneralQuestionQa: async () => ({
    items: [],
    totalCount: 0,
    pendingCount: 0,
    page: 1,
  }),
}));
vi.mock("../repositories/general-question-qa-repository", () => ({
  findFailedGeneralQuestionImports: async () => [],
  findGeneralQuestionClassifications: async () => ({
    items: [
      {
        itemRevisionId: "item-1",
        summary: "防災について",
        speakerName: "検証議員",
        classifiedTopicIds: ["topic-a"],
        classifiedTopicLabels: ["分野A"],
      },
    ],
    topics: [
      { id: "topic-a", label: "分野A", description: "分類済み" },
      { id: "topic-b", label: "分野B", description: "未分類" },
    ],
    totalCount: 1,
    page: 1,
  }),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.assign(globalThis, {
  React,
  ResizeObserver: ResizeObserverStub,
  IS_REACT_ACT_ENVIRONMENT: true,
});

describe("GeneralQuestionQaPage", () => {
  it("既存の政策分野だけを選択済みで表示する", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        await GeneralQuestionQaPage({ qaPage: 1, classificationPage: 1 })
      );
    });

    const topicA = container.querySelector<HTMLButtonElement>(
      "#topic-item-1-topic-a"
    );
    const topicB = container.querySelector<HTMLButtonElement>(
      "#topic-item-1-topic-b"
    );
    const classificationForm = topicA?.closest("form");
    if (!(topicA && topicB && classificationForm)) {
      throw new Error("政策分野の分類フォームを取得できませんでした");
    }

    expect(topicA.getAttribute("aria-checked")).toBe("true");
    expect(topicB.getAttribute("aria-checked")).toBe("false");
    expect(new FormData(classificationForm).getAll("topicId")).toEqual([
      "topic-a",
    ]);

    await act(async () => root.unmount());
    container.remove();
  });
});
