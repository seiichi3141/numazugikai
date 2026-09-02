import { describe, expect, it } from "vitest";
import { buildThumbnailKeyPrompt } from "./build-thumbnail-key-prompt";

describe("buildThumbnailKeyPrompt", () => {
  const bill = {
    name: "工事請負契約の締結（沼津市立金岡小学校校舎等外壁改修他工事）",
    categoryLabel: "契約・財産",
    title: "金岡小学校の外壁・屋上・トイレなどを改修",
    summary: "金岡小学校の校舎の外壁などを改修する工事の契約です。",
  };

  it("題材の一覧と議案の情報を含む", () => {
    const prompt = buildThumbnailKeyPrompt(bill);
    expect(prompt).toContain("- school-building:");
    expect(prompt).toContain("- general:");
    expect(prompt).toContain(`正式名称: ${bill.name}`);
    expect(prompt).toContain("分類: 契約・財産");
    expect(prompt).toContain(`タイトル: ${bill.title}`);
    expect(prompt).toContain(`要約: ${bill.summary}`);
  });

  it("無い情報の行は出さない", () => {
    const prompt = buildThumbnailKeyPrompt({
      name: "令和８年度沼津市一般会計予算",
      categoryLabel: null,
      title: null,
      summary: null,
    });
    expect(prompt).toContain("正式名称: 令和８年度沼津市一般会計予算");
    expect(prompt).not.toContain("分類:");
    expect(prompt).not.toContain("タイトル:");
    expect(prompt).not.toContain("要約:");
  });
});
