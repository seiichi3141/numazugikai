import { describe, expect, it } from "vitest";
import {
  inferCurrentBillCategory,
  parseCurrentSessionBillsHtml,
} from "./parse-current-session-bills";

const PAGE_URL =
  "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/oshirase.htm";

const HTML = `
  <h2 class="h2_main">第14回（令和8年9月）定例会</h2>
  <a name="teisyutu"></a>
  <h2>提出議案</h2>
  <ul class="list_disk">
    <li>報第22号　専決処分の報告について（損害賠償額の決定）</li>
    <li><a href="houkoku/gian0809/nin-1.pdf">認第36号　令和7年度沼津市一般会計歳入歳出決算の認定について（PDF：27KB）</a></li>
    <li><a href="houkoku/gian0809/gi-1.pdf">議第78号　沼津市保育施設条例の一部改正について（PDF：146KB）</a></li>
    <!-- <li><a href="future.pdf">議第90号　追加予定の議案について（PDF：〇KB）</a></li> -->
  </ul>
`;

describe("parseCurrentSessionBillsHtml", () => {
  it("会期情報とリンクのない提出議案を読み取る", () => {
    const parsed = parseCurrentSessionBillsHtml(HTML, PAGE_URL);

    expect(parsed).toMatchObject({
      label: "第14回（令和8年9月）定例会",
      year: 2026,
      month: 9,
      sessionNumber: 14,
      kind: "regular",
    });
    expect(parsed?.bills).toEqual([
      {
        billNumber: "報第22号",
        numberKind: "hou",
        numberValue: 22,
        title: "専決処分の報告について（損害賠償額の決定）",
        category: "report",
        submitter: null,
        submittedOn: null,
        documentUrl: null,
      },
      {
        billNumber: "認第36号",
        numberKind: "nin",
        numberValue: 36,
        title: "令和7年度沼津市一般会計歳入歳出決算の認定",
        category: "settlement",
        submitter: null,
        submittedOn: null,
        documentUrl:
          "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/gian0809/nin-1.pdf",
      },
      {
        billNumber: "議第78号",
        numberKind: "gi",
        numberValue: 78,
        title: "沼津市保育施設条例の一部改正",
        category: "ordinance",
        submitter: null,
        submittedOn: null,
        documentUrl:
          "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/gian0809/gi-1.pdf",
      },
    ]);
  });

  it("HTMLコメント内の追加予定議案を除外する", () => {
    const numbers =
      parseCurrentSessionBillsHtml(HTML)?.bills.map(
        (bill) => bill.billNumber
      ) ?? [];
    expect(numbers).not.toContain("議第90号");
  });

  it("番号種別から提出者を確定できる議案だけ提出者を補う", () => {
    const html = HTML.replace(
      "</ul>",
      "<li>発議第1号　市政に関する意見書について</li><li>請願第2号　公共交通の充実を求める請願について</li></ul>"
    );

    expect(parseCurrentSessionBillsHtml(html)?.bills.slice(-2)).toMatchObject([
      { billNumber: "発議第1号", submitter: null },
      { billNumber: "請願第2号", submitter: "citizen" },
    ]);
  });

  it("会期または提出議案一覧がなければnullを返す", () => {
    expect(parseCurrentSessionBillsHtml("<h1>お知らせ</h1>")).toBeNull();
  });

  it("提出議案一覧に未解釈の項目があれば部分保存せずnullを返す", () => {
    const html = HTML.replace(
      "</ul>",
      "<li>新しい番号形式　解析できない議案</li></ul>"
    );
    expect(parseCurrentSessionBillsHtml(html, PAGE_URL)).toBeNull();
  });

  it("追加議案の日付を保持しPDF表記を件名から除く", () => {
    const html = `
      <h2>第12回（令和8年6月）定例会</h2>
      <a name="teisyutu"></a>
      <ul class="list_disk">
        <li><a href="gi-16.pdf">議第71号　条例の一部改正について（PDF：65KB）</a><strong>【令和8年6月17日に追加された議案】</strong></li>
      </ul>
    `;
    expect(
      parseCurrentSessionBillsHtml(html, PAGE_URL)?.bills[0]
    ).toMatchObject({
      title: "条例の一部改正",
      submittedOn: "2026-06-17",
    });
  });

  it("臨時会の種別を判定する", () => {
    const html = HTML.replace("定例会", "臨時会");
    expect(parseCurrentSessionBillsHtml(html)?.kind).toBe("extraordinary");
  });
});

describe("inferCurrentBillCategory", () => {
  it.each([
    ["専決処分の報告", "hou", "report"],
    ["令和7年度一般会計決算の認定", "nin", "settlement"],
    ["教育委員会委員の任命", "nin", "personnel"],
    ["一般会計補正予算", "gi", "budget"],
    [
      "専決処分の報告及びその承認（一般会計補正予算）",
      "gi",
      "provisional_approval",
    ],
    ["市景観条例の一部改正", "gi", "ordinance"],
    ["財産の取得", "gi", "contract"],
    ["市政に関する意見書", "hatsugi", "opinion_paper"],
    ["公共交通の充実を求める請願", "seigan", "petition"],
  ] as const)("%sを%sから%sに分類する", (title, kind, expected) => {
    expect(inferCurrentBillCategory(title, kind)).toBe(expected);
  });
});
