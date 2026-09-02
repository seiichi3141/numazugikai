import { describe, expect, it } from "vitest";
import { redactExternalUrls } from "./redact-external-urls";

describe("redactExternalUrls", () => {
  it.each([
    "https://example.com/path",
    "ftp://example.com/file",
    "mailto:contact@example.com",
    "javascript:alert(example.com)",
    "data:text/plain,example.com",
    "www.example.com/path",
    "numazu-city.jp/source",
    "例え.テスト/資料",
    "contact@example.com",
    "//example.com/path",
    "//例え.テスト/path",
  ])("外部URL形式を回答から除去する: %s", (url) => {
    const result = redactExternalUrls(`参照先: ${url}`);

    expect(result).toBe("参照先: [外部リンクは表示できません]");
    expect(result).not.toContain("example.com");
  });

  it("Markdownやコードブロック内の外部URLも除去する", () => {
    const result = redactExternalUrls(
      "[出典](https://example.com/source)\n`https://example.net/code`"
    );

    expect(result).toBe(
      "[外部リンクは表示できません]\n`[外部リンクは表示できません]`"
    );
  });

  it("URLの後に続く日本語の句読点と文章を保持する", () => {
    const result = redactExternalUrls(
      "参照先は https://example.com/path。詳しく説明します。"
    );

    expect(result).toBe(
      "参照先は [外部リンクは表示できません]。詳しく説明します。"
    );
  });

  it("山括弧形式の外部リンクを構造ごと除去する", () => {
    expect(redactExternalUrls("参照: <https://example.com/path>。続き")).toBe(
      "参照: [外部リンクは表示できません]。続き"
    );
  });

  it.each([
    "[出典](https://example.com/a_(b))",
    "[出典](<https://example.com/a>)",
  ])("複雑なMarkdown外部リンクを構造ごと除去する: %s", (text) => {
    expect(redactExternalUrls(text)).toBe("[外部リンクは表示できません]");
  });

  it("本サービス内の相対リンクは保持する", () => {
    const text = "[テスト議案](/bills/bill-123)";

    expect(redactExternalUrls(text)).toBe(text);
  });

  it.each([
    "[テスト議案](https://mirai-numazu.com/bills/bill-123)",
    "https://mirai-numazu.com/bills/bill-123",
  ])("本サービスと同一オリジンの絶対URLは保持する: %s", (text) => {
    expect(redactExternalUrls(text, "https://mirai-numazu.com")).toBe(text);
  });

  it("同一オリジンに似せた外部URLは除去する", () => {
    expect(
      redactExternalUrls(
        "https://mirai-numazu.com.evil.example/bills/bill-123",
        "https://mirai-numazu.com"
      )
    ).toBe("[外部リンクは表示できません]");
  });
});
