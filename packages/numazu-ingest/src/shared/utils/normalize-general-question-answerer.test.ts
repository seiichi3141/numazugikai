import { describe, expect, it } from "vitest";
import { normalizeGeneralQuestionAnswerer } from "./normalize-general-question-answerer";

describe("normalizeGeneralQuestionAnswerer", () => {
  it.each([
    ["市 長", "mayor"],
    ["副市長", "deputy_mayor"],
    ["教育委員会教育長", "superintendent"],
    ["企画部長", "department_head"],
    ["広報課長", "division_head"],
    ["選挙管理委員会委員長", "administration_other"],
    ["参考人", "unknown"],
  ] as const)("%s を %s に分類する", (label, expected) => {
    expect(normalizeGeneralQuestionAnswerer(label).roleGroup).toBe(expected);
  });
});
