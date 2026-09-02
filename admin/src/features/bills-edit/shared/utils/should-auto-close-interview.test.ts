import { describe, expect, it } from "vitest";
import { shouldAutoCloseInterviewOnBillStatus } from "./should-auto-close-interview";

describe("shouldAutoCloseInterviewOnBillStatus", () => {
  it("本会議で結論が出た議案はインタビューを閉じる", () => {
    for (const status of [
      "passed",
      "rejected",
      "consented",
      "approved",
      "certified",
      "adopted",
      "not_adopted",
      "withdrawn",
    ] as const) {
      expect(shouldAutoCloseInterviewOnBillStatus(status)).toBe(true);
    }
  });

  it("まだ結論が出ていない議案は閉じない", () => {
    for (const status of ["preparing", "submitted", "in_committee"] as const) {
      expect(shouldAutoCloseInterviewOnBillStatus(status)).toBe(false);
    }
  });

  it("継続審査は次の会期で審議が続くため閉じない", () => {
    expect(shouldAutoCloseInterviewOnBillStatus("continued")).toBe(false);
  });

  it("報告事項は議決を伴わないため閉じない", () => {
    expect(shouldAutoCloseInterviewOnBillStatus("reported")).toBe(false);
  });
});
