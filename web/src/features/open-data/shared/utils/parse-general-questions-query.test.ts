import { describe, expect, it } from "vitest";
import { parseGeneralQuestionsQuery } from "./parse-general-questions-query";

describe("parseGeneralQuestionsQuery", () => {
  it("フィルターとCSV形式を受け付ける", () => {
    const result = parseGeneralQuestionsQuery(
      new URLSearchParams("year=2026&topic=disaster&format=csv")
    );
    expect(result).toMatchObject({
      ok: true,
      year: 2026,
      topic: "disaster",
      format: "csv",
    });
  });

  it("対象範囲外の年を拒否する", () => {
    expect(
      parseGeneralQuestionsQuery(new URLSearchParams("year=1989"))
    ).toEqual({
      ok: false,
      error: "year は1990以降の西暦で指定してください",
    });
  });

  it("会議記録の提供開始年を受け付ける", () => {
    expect(
      parseGeneralQuestionsQuery(new URLSearchParams("year=1990"))
    ).toMatchObject({ ok: true, year: 1990 });
  });

  it("未対応の質問種別を拒否する", () => {
    expect(
      parseGeneralQuestionsQuery(
        new URLSearchParams("questionKind=unsupported")
      )
    ).toEqual({
      ok: false,
      error:
        "questionKind は representative / personal / other / unknown のいずれかで指定してください",
    });
  });
});
