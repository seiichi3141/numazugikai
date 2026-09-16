import { describe, expect, it } from "vitest";
import {
  getMonthDateRange,
  inferGeneralQuestionSessionNumber,
} from "./infer-general-question-session-number";

describe("inferGeneralQuestionSessionNumber", () => {
  it("第20期の回数表記がない資料を定例会順へ対応させる", () => {
    expect(inferGeneralQuestionSessionNumber(20, 2004, 6)).toBe(5);
    expect(inferGeneralQuestionSessionNumber(20, 2004, 9)).toBe(6);
    expect(inferGeneralQuestionSessionNumber(20, 2007, 2)).toBe(16);
  });

  it("定例会月以外と任期外を推測しない", () => {
    expect(inferGeneralQuestionSessionNumber(20, 2004, 7)).toBeNull();
    expect(inferGeneralQuestionSessionNumber(20, 2002, 11)).toBeNull();
  });

  it("旧資料の表題月を会期突合用の日付範囲へ変換する", () => {
    expect(getMonthDateRange(2004, 2)).toEqual({
      startDate: "2004-02-01",
      endDate: "2004-02-29",
    });
  });
});
