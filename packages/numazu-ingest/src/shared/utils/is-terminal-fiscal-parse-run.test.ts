import { describe, expect, it } from "vitest";
import { isTerminalFiscalParseRun } from "./is-terminal-fiscal-parse-run";

describe("isTerminalFiscalParseRun", () => {
  it("完了と決定的な解析失敗を処理済みとする", () => {
    expect(
      isTerminalFiscalParseRun({ status: "completed", parseStats: null })
    ).toBe(true);
    expect(
      isTerminalFiscalParseRun({
        status: "failed",
        parseStats: { hardErrorCount: 1 },
      })
    ).toBe(true);
    expect(
      isTerminalFiscalParseRun({ status: "rejected", parseStats: null })
    ).toBe(true);
  });

  it("運用上の一時失敗は再試行対象にする", () => {
    expect(
      isTerminalFiscalParseRun({
        status: "failed",
        parseStats: { retryable: true },
      })
    ).toBe(false);
  });
});
