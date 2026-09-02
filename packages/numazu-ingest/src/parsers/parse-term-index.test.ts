import { describe, expect, it } from "vitest";
import { allTerms, parseTermIndex } from "./parse-term-index";

describe("parseTermIndex", () => {
  it("期のページから議案審議結果PDFを見つける", () => {
    const html = `
      <a href="teirei_25_pdf/gian-0806.pdf">議案審議（PDF：165KB）</a>
      <a href="teirei_25_pdf/ippan-0806.pdf">一般質問（PDF：392KB）</a>
      <a href="teirei_25_pdf/gian-0802.pdf">議案審議（PDF：97KB）</a>
    `;
    expect(parseTermIndex(html, 25)).toEqual([
      { path: "teirei_25_pdf/gian-0802.pdf", eraYear: 8, month: 2 },
      { path: "teirei_25_pdf/gian-0806.pdf", eraYear: 8, month: 6 },
    ]);
  });

  it("一般質問や会期日程のPDFは拾わない", () => {
    const html = `
      <a href="teirei_25_pdf/nittei-0806.pdf">会期日程</a>
      <a href="teirei_25_pdf/ippan-0806.pdf">一般質問</a>
      <a href="teirei_25_pdf/08gianshitugi-0806.pdf">議案質疑</a>
    `;
    expect(parseTermIndex(html, 25)).toEqual([]);
  });

  it("他の期のPDFは拾わない", () => {
    const html = `
      <a href="teirei_24_pdf/gian-0105.pdf">議案審議</a>
      <a href="teirei_25_pdf/gian-0505.pdf">議案審議</a>
    `;
    expect(parseTermIndex(html, 25)).toEqual([
      { path: "teirei_25_pdf/gian-0505.pdf", eraYear: 5, month: 5 },
    ]);
  });

  it("同じPDFが複数回現れても1件にする", () => {
    const html = `
      <a href="teirei_25_pdf/gian-0806.pdf">議案審議</a>
      <a href="teirei_25_pdf/gian-0806.pdf">議案審議（再掲）</a>
    `;
    expect(parseTermIndex(html, 25)).toHaveLength(1);
  });

  it("会期の順に並べる", () => {
    const html = `
      <a href="teirei_20_pdf/gian-1902.pdf">x</a>
      <a href="teirei_20_pdf/gian-1606.pdf">x</a>
      <a href="teirei_20_pdf/gian-1611.pdf">x</a>
    `;
    expect(parseTermIndex(html, 20).map((p) => p.path)).toEqual([
      "teirei_20_pdf/gian-1606.pdf",
      "teirei_20_pdf/gian-1611.pdf",
      "teirei_20_pdf/gian-1902.pdf",
    ]);
  });

  it("PDFが無ければ空配列", () => {
    expect(parseTermIndex("<p>準備中</p>", 25)).toEqual([]);
  });
});

describe("allTerms", () => {
  it("公開されている第20期から第25期までを返す", () => {
    expect(allTerms()).toEqual([20, 21, 22, 23, 24, 25]);
  });
});
