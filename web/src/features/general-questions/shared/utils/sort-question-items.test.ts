import { describe, expect, it } from "vitest";
import { sortQuestionItems } from "./sort-question-items";

describe("sortQuestionItems", () => {
  it("入力順に依存せず親の直後へ子項目を資料順で並べる", () => {
    const items = [
      { id: "child-2", parentItemId: "parent", order: 2 },
      { id: "other", parentItemId: null, order: 2 },
      { id: "child-1", parentItemId: "parent", order: 1 },
      { id: "parent", parentItemId: null, order: 1 },
    ];
    expect(sortQuestionItems(items).map((item) => item.id)).toEqual([
      "parent",
      "child-1",
      "child-2",
      "other",
    ]);
  });

  it("参照先がない項目も欠落させない", () => {
    const items = [{ id: "orphan", parentItemId: "missing", order: 1 }];
    expect(sortQuestionItems(items)).toEqual(items);
  });
});
