import { describe, expect, it } from "vitest";
import { parseGeneralQuestionIndexHtml } from "./parse-general-question-index";

describe("parseGeneralQuestionIndexHtml", () => {
  it("相対URLを解決し一般質問PDFだけを重複なく返す", () => {
    const html = `
      <a href="pdf/general-question-r08-06.pdf">一般質問通告一覧</a>
      <a href="pdf/general-question-r08-06.pdf">同じPDF</a>
      <a href="pdf/gian-r08-06.pdf">議案審議結果</a>
      <a href="/docs/representative.pdf">代表質問</a>
    `;
    expect(
      parseGeneralQuestionIndexHtml(
        html,
        "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/"
      )
    ).toEqual([
      {
        url: "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/pdf/general-question-r08-06.pdf",
        label: "一般質問通告一覧",
      },
      {
        url: "https://www.city.numazu.shizuoka.jp/docs/representative.pdf",
        label: "代表質問",
      },
    ]);
  });
});
