import { describe, expect, it } from "vitest";
import {
  buildGeneralQuestionSummaryPrompt,
  GENERAL_QUESTION_SUMMARY_MAX_LENGTH,
  validateGeneratedSummaries,
} from "./general-question-summary";

const sourceItems = [
  {
    sourceKey: "item-1",
    label: "市役所周辺の交通について",
    parentSourceKey: null,
  },
  { sourceKey: "item-1-1", label: "自転車通行帯", parentSourceKey: "item-1" },
];

describe("general question AI summaries", () => {
  it("builds a bounded prompt using only supplied source context", () => {
    const prompt = buildGeneralQuestionSummaryPrompt({
      councilName: "沼津市議会",
      speakerName: "沼津 花子",
      items: sourceItems,
    });
    expect(prompt).toContain("入力にない事実");
    expect(prompt).toContain("sourceKey: item-1-1");
    expect(prompt).toContain("原文見出し: 自転車通行帯");
  });

  it("returns a source-keyed map when every item is present once", () => {
    expect(
      validateGeneratedSummaries(sourceItems, [
        { sourceKey: "item-1", summary: "市役所周辺の交通環境" },
        { sourceKey: "item-1-1", summary: "市役所周辺の自転車通行帯" },
      ])
    ).toEqual({
      "item-1": "市役所周辺の交通環境",
      "item-1-1": "市役所周辺の自転車通行帯",
    });
  });

  it("rejects missing, duplicate, unknown, or overlong output", () => {
    expect(() => validateGeneratedSummaries(sourceItems, [])).toThrow();
    expect(() =>
      validateGeneratedSummaries(sourceItems, [
        { sourceKey: "item-1", summary: "要約" },
        { sourceKey: "item-1", summary: "重複" },
      ])
    ).toThrow("重複");
    expect(() =>
      validateGeneratedSummaries(sourceItems, [
        { sourceKey: "unknown", summary: "要約" },
      ])
    ).toThrow("不明");
    expect(() =>
      validateGeneratedSummaries(sourceItems, [
        {
          sourceKey: "item-1",
          summary: "あ".repeat(GENERAL_QUESTION_SUMMARY_MAX_LENGTH + 1),
        },
        { sourceKey: "item-1-1", summary: "要約" },
      ])
    ).toThrow("長さ");
  });
});
