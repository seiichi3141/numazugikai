import { describe, expect, it } from "vitest";
import { collectFiscalValidationMessages } from "./collect-fiscal-validation-messages";

describe("collectFiscalValidationMessages", () => {
  it("検算メッセージを重複なく順に返す", () => {
    expect(
      collectFiscalValidationMessages([
        { severity: "warning", message: "表題を確認" },
        { severity: "hard_error", message: "合計不一致" },
        { severity: "warning", message: "表題を確認" },
      ])
    ).toEqual(["warning: 表題を確認", "hard_error: 合計不一致"]);
  });

  it("不正な形式と空メッセージを表示しない", () => {
    expect(collectFiscalValidationMessages({})).toEqual([]);
    expect(collectFiscalValidationMessages([{ message: " " }, null])).toEqual(
      []
    );
  });
});
