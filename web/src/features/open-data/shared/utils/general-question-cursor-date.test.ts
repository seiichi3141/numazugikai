import { describe, expect, it } from "vitest";
import { generalQuestionCursorDate } from "./general-question-cursor-date";

describe("generalQuestionCursorDate", () => {
  it("同じ開催日では若い質問順が降順ソートの先になる", () => {
    expect(
      generalQuestionCursorDate("2026-09-03", "2026-09-01", 1) >
        generalQuestionCursorDate("2026-09-03", "2026-09-01", 2)
    ).toBe(true);
  });

  it("開催日不明時は会期開始日を使い、順番不明を末尾に置く", () => {
    expect(generalQuestionCursorDate(null, "2026-09-01", null)).toBe(
      "2026-09-01T00:00:00.000000Z"
    );
  });
});
