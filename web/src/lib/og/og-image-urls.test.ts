import { describe, expect, it } from "vitest";
import { ogImageUrls } from "./og-image-urls";

const WEB_URL = "https://example.com";

describe("ogImageUrls", () => {
  it("議案の画像URLに id を付ける", () => {
    expect(ogImageUrls.bill("abc-123", WEB_URL)).toBe(
      "https://example.com/api/og/bill?id=abc-123"
    );
  });

  it("version を渡すと URL が変わる", () => {
    // 内容が更新されたら別 URL になり、SNS 側のキャッシュが自然に切れる
    const a = ogImageUrls.bill("x", WEB_URL, "2026-06-01T00:00:00Z");
    const b = ogImageUrls.bill("x", WEB_URL, "2026-06-02T00:00:00Z");
    expect(a).not.toBe(b);
    expect(new URL(a).searchParams.get("v")).toBe("2026-06-01T00:00:00Z");
  });

  it("version が無ければ v を付けない", () => {
    expect(ogImageUrls.bill("x", WEB_URL, null)).not.toContain("v=");
  });

  it("相対パス版はサイト内の next/image にそのまま渡せる", () => {
    // 絶対 URL だと同一オリジンでも remotePatterns の設定が要る
    expect(ogImageUrls.billPath("x", "1")).toBe("/api/og/bill?id=x&v=1");
    expect(ogImageUrls.billPath("x")).toBe("/api/og/bill?id=x");
  });

  it("id に記号があっても URL として壊れない", () => {
    const url = new URL(ogImageUrls.bill("a b&c", WEB_URL));
    expect(url.searchParams.get("id")).toBe("a b&c");
  });

  it("レポートの画像URLに id を付ける", () => {
    expect(ogImageUrls.report("r-1", WEB_URL)).toBe(
      "https://example.com/api/og/report?id=r-1"
    );
  });

  it("サイト共通の画像URLを返す", () => {
    expect(ogImageUrls.site(WEB_URL)).toBe("https://example.com/api/og/site");
  });
});
