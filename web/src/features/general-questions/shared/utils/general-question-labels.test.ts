import { describe, expect, it } from "vitest";
import { generalQuestionLabel } from "./general-question-labels";

describe("generalQuestionLabel", () => {
  it("公開enumを日本語表示へ変換する", () => {
    expect(generalQuestionLabel("one_by_one")).toBe("一問一答方式");
    expect(generalQuestionLabel("source_not_published")).toBe("公式資料未公開");
    expect(generalQuestionLabel("meeting_record")).toBe("会議録");
  });
  it("未知の値は欠落させない", () => {
    expect(generalQuestionLabel("future_value")).toBe("future_value");
  });
});
