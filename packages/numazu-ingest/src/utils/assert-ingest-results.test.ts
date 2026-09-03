import { describe, expect, it } from "vitest";
import {
  assertGianResultHasBills,
  assertNoBillFailuresForEraYear,
} from "./assert-ingest-results";

describe("assertNoBillFailuresForEraYear", () => {
  it("対象年の失敗があればパスと理由を含めて失敗する", () => {
    const result = {
      failures: [
        {
          path: "teirei_25_pdf/gian-0809.pdf",
          eraYear: 8,
          reason: "PDFを取得できなかった",
        },
      ],
    };

    expect(() => assertNoBillFailuresForEraYear(result, 8)).toThrow(
      "gian-0809.pdf: PDFを取得できなかった"
    );
  });

  it("過去年の失敗だけなら定期実行を継続する", () => {
    const result = {
      failures: [
        {
          path: "teirei_25_pdf/gian-0706.pdf",
          eraYear: 7,
          reason: "旧形式を解析できなかった",
        },
      ],
    };

    expect(() => assertNoBillFailuresForEraYear(result, 8)).not.toThrow();
  });
});

describe("assertGianResultHasBills", () => {
  it("議案が0件なら取得元を含めて失敗する", () => {
    expect(() =>
      assertGianResultHasBills({ bills: [] }, "https://example.com/gian.pdf")
    ).toThrow("議案を1件も読み取れなかった: https://example.com/gian.pdf");
  });

  it("議案があれば継続する", () => {
    expect(() =>
      assertGianResultHasBills({ bills: [{}] }, "https://example.com/gian.pdf")
    ).not.toThrow();
  });
});
