import { describe, expect, it } from "vitest";
import {
  parseAmivoiceHitCount,
  parseAmivoiceSearchResult,
} from "./parse-amivoice-search";

const RESULT = `
  <div>7 件の文書、 18 件の発言が該当しました。</div>
  <tr><td>2019/12/09</td><td>文教産業委員会 令和元年12月9日（月）</td>
    <td><a onClick="DataSubmit2('v20191209_01.vcsv','','9','x')">植松委員</a></td></tr>
  <tr><td>2019/06/20</td><td>文教産業委員会 令和元年6月20日（木）</td>
    <td><a onClick="DataSubmit2('v20190620_01.vcsv','','9','x')">委員長</a></td></tr>
`;

describe("parseAmivoiceSearchResult", () => {
  const hits = parseAmivoiceSearchResult(RESULT);

  it("会議記録IDと開催日を取る", () => {
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      vcsv: "v20190620_01",
      date: "2019-06-20",
    });
  });

  it("開催日の古い順に並べる", () => {
    expect(hits.map((h) => h.date)).toEqual(["2019-06-20", "2019-12-09"]);
  });

  it("会議名を拾う", () => {
    expect(hits[0].meetingName).toContain("文教産業委員会");
  });

  it("同じ会議記録が複数回現れても1件にする", () => {
    const dup = RESULT + RESULT;
    expect(parseAmivoiceSearchResult(dup)).toHaveLength(2);
  });

  it("該当なしでは空配列", () => {
    expect(
      parseAmivoiceSearchResult(
        "検索条件に一致する議事録は見つかりませんでした。"
      )
    ).toEqual([]);
    expect(parseAmivoiceSearchResult("")).toEqual([]);
  });
});

describe("parseAmivoiceHitCount", () => {
  it("該当件数を読む", () => {
    expect(parseAmivoiceHitCount(RESULT)).toBe(7);
  });

  it("件数表示が無ければ null", () => {
    expect(parseAmivoiceHitCount("<p>準備中</p>")).toBeNull();
  });

  it("0件も数値として返す", () => {
    expect(parseAmivoiceHitCount("0 件の文書、 0 件の発言")).toBe(0);
  });
});
