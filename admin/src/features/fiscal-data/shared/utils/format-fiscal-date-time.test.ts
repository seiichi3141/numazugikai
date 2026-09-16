import { describe, expect, it } from "vitest";
import { formatFiscalDateTime } from "./format-fiscal-date-time";

describe("formatFiscalDateTime", () => {
  it("UTC日時を日本時間で表示する", () => {
    expect(formatFiscalDateTime("2026-09-04T15:00:00.000Z")).toContain(
      "2026/09/05"
    );
  });

  it("日時が無い場合は不明と表示する", () => {
    expect(formatFiscalDateTime(null)).toBe("不明");
  });
});
