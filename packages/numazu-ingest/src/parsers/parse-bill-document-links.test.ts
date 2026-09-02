import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBillDocumentLinks } from "./parse-bill-document-links";

const FIXTURES = join(import.meta.dirname, "__fixtures__");
const PAGE_URL =
  "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/oshirase.htm";

describe("parseBillDocumentLinks: 実際の本会議のお知らせページ", () => {
  const links = parseBillDocumentLinks(
    readFileSync(join(FIXTURES, "oshirase.html"), "utf-8"),
    PAGE_URL
  );

  it("議案本文PDFのリンクを取る", () => {
    // 令和8年6月定例会は 議第56〜74号・報第18〜21号・発議第4〜5号 が掲載されている
    expect(links.length).toBeGreaterThanOrEqual(25);
  });

  it("議案番号と件名とURLを組にする", () => {
    const found = links.find((link) => link.billNumber === "議第58号");
    expect(found).toEqual({
      billNumber: "議第58号",
      title: "沼津市印鑑条例の一部改正",
      url: "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25_pdf/gian0806/gi-3.pdf",
    });
  });

  it("報告・発議のリンクも拾う", () => {
    expect(links.find((link) => link.billNumber === "報第18号")).toBeTruthy();
    expect(links.find((link) => link.billNumber === "発議第4号")).toBeTruthy();
  });

  it("会期日程や一般質問など議案でないPDFは拾わない", () => {
    const urls = links.map((link) => link.url);
    expect(urls.some((url) => url.includes("nittei-"))).toBe(false);
    expect(urls.some((url) => url.includes("ippan-"))).toBe(false);
  });

  it("議案番号は重複させない", () => {
    const numbers = links.map((link) => link.billNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

describe("parseBillDocumentLinks: 個別のケース", () => {
  it("末尾の「について」とファイルサイズ表記を落とす", () => {
    const html =
      '<a href="gi-1.pdf">議第56号　あらたに生じた土地の確認について（西浦古宇）（PDF：163KB）</a>';
    expect(parseBillDocumentLinks(html)[0]).toEqual({
      billNumber: "議第56号",
      title: "あらたに生じた土地の確認について（西浦古宇）",
      url: "gi-1.pdf",
    });
  });

  it("相対URLを絶対URLに直す", () => {
    const html =
      '<a href="houkoku/teirei_25_pdf/gian0806/gi-3.pdf">議第58号　テスト</a>';
    expect(parseBillDocumentLinks(html, PAGE_URL)[0].url).toBe(
      "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/teirei_25_pdf/gian0806/gi-3.pdf"
    );
  });

  it("baseUrl がなければ href をそのまま返す", () => {
    const html = '<a href="/a/b.pdf">議第1号　テスト</a>';
    expect(parseBillDocumentLinks(html)[0].url).toBe("/a/b.pdf");
  });

  it("PDF以外のリンクは対象外", () => {
    const html = '<a href="/page.htm">議第58号　沼津市印鑑条例の一部改正</a>';
    expect(parseBillDocumentLinks(html)).toEqual([]);
  });

  it("議案番号で始まらないリンクは対象外", () => {
    const html = '<a href="a.pdf">第13回沼津市議会定例会　会期日程</a>';
    expect(parseBillDocumentLinks(html)).toEqual([]);
  });

  it("全角数字の議案番号も正規化する", () => {
    const html =
      '<a href="ha-1.pdf">発議第４号　永年勤続議員に対する感謝状の贈呈</a>';
    expect(parseBillDocumentLinks(html)[0].billNumber).toBe("発議第4号");
  });

  it("リンクがなければ空配列", () => {
    expect(parseBillDocumentLinks("")).toEqual([]);
  });
});
