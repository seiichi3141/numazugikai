import { describe, expect, it } from "vitest";
import { buildBillTagPrompt } from "./build-bill-tag-prompt";

describe("buildBillTagPrompt", () => {
  it("DBのタグ候補と議案の根拠情報を含める", () => {
    const prompt = buildBillTagPrompt(
      {
        name: "市立小学校校舎改築工事請負契約の締結",
        categoryLabel: "契約",
        title: "小学校の校舎を改築します",
        summary: "老朽化した校舎を改築するための契約です。",
        explanationSource: "校舎の安全性を確保するため改築工事を行う。",
      },
      [
        { label: "子育て・教育", description: "学校や教育" },
        { label: "暮らし・まちづくり", description: "道路や公共施設" },
      ]
    );

    expect(prompt).toContain("子育て・教育: 学校や教育");
    expect(prompt).toContain("市立小学校校舎改築工事請負契約の締結");
    expect(prompt).toContain("手続きの種類ではなく");
  });

  it("長い原資料は上限で切る", () => {
    const included = "あ".repeat(6_000);
    const prompt = buildBillTagPrompt(
      {
        name: "議案",
        categoryLabel: null,
        title: null,
        summary: null,
        explanationSource: `${included}末尾には含めない`,
      },
      [{ label: "行財政・人事", description: null }]
    );

    expect(prompt).toContain(included);
    expect(prompt).not.toContain("末尾には含めない");
  });
});
