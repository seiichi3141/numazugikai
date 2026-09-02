import { describe, expect, it } from "vitest";
import { buildTopChatSystemPrompt } from "./top-chat-system";

describe("buildTopChatSystemPrompt", () => {
  it("議案情報と提案時のリンク規則を含む", () => {
    const billSummary = JSON.stringify([
      {
        name: "テスト議案",
        url: "/bills/bill-1",
        isFeatured: true,
      },
    ]);

    const result = buildTopChatSystemPrompt(billSummary);

    expect(result).toContain(billSummary);
    expect(result).toContain("Markdownリンク");
    expect(result).toContain("必ず添えてください");
    expect(result).toContain("URLを推測して作らないでください");
    expect(result).toContain("外部サイトのURLやリンク");
    expect(result).toContain("一切回答に含めないで");
    expect(result).not.toContain("Web検索ツールの利用ルール");
  });
});
