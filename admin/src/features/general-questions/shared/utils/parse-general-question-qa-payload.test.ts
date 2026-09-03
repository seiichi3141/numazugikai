import { describe, expect, it } from "vitest";
import {
  parseGeneralQuestionSourceItems,
  parseGeneralQuestionSummaryMap,
} from "./parse-general-question-qa-payload";

describe("parseGeneralQuestionSourceItems", () => {
  it("有効な項目を正規化する", () => {
    expect(
      parseGeneralQuestionSourceItems([
        { sourceKey: "item-1", label: "防災", parentSourceKey: null },
        {
          sourceKey: "item-1-1",
          label: "避難所",
          parentSourceKey: "item-1",
        },
      ])
    ).toEqual([
      { sourceKey: "item-1", label: "防災", parentSourceKey: null },
      {
        sourceKey: "item-1-1",
        label: "避難所",
        parentSourceKey: "item-1",
      },
    ]);
  });

  it("非配列・欠損・空文字・重複キーを除外する", () => {
    expect(parseGeneralQuestionSourceItems(null)).toEqual([]);
    expect(
      parseGeneralQuestionSourceItems([
        null,
        { sourceKey: "", label: "空キー" },
        { sourceKey: "missing-label" },
        { sourceKey: "item-1", label: "採用" },
        { sourceKey: "item-1", label: "重複" },
      ])
    ).toEqual([{ sourceKey: "item-1", label: "採用", parentSourceKey: null }]);
  });
});

describe("parseGeneralQuestionSummaryMap", () => {
  it("文字列値だけを保持する", () => {
    expect(
      parseGeneralQuestionSummaryMap({ valid: "要約", invalid: 1 })
    ).toEqual({ valid: "要約" });
    expect(parseGeneralQuestionSummaryMap([])).toEqual({});
  });
});
