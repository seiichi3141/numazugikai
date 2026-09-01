import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractBillExplanations, extractDebates } from "./parse-minutes";

const FIXTURES = join(import.meta.dirname, "__fixtures__");
const loadFixture = (name: string) =>
  readFileSync(join(FIXTURES, name), "utf-8");

// 令和8年第12回（2月）定例会 2月6日本会議「令和7年度関係議案説明」
const EXPLANATION = loadFixture("minutes-explanation-r08-12.txt");
// 同 3月17日本会議「質疑、討論、採決」
const DEBATE = loadFixture("minutes-debate-r08-12.txt");

describe("extractBillExplanations", () => {
  const explanations = extractBillExplanations(EXPLANATION);
  const find = (billNumber: string) => {
    const found = explanations.find((e) => e.billNumber === billNumber);
    if (!found) throw new Error(`${billNumber} の説明が見つからない`);
    return found;
  };

  it("当局が1件ずつ説明した議案をすべて拾う", () => {
    // この日の議題は報第1〜7号・認第1〜4号・議第1〜17号ほか
    expect(explanations.length).toBeGreaterThanOrEqual(30);
  });

  it("議案番号を重複させない", () => {
    const numbers = explanations.map((e) => e.billNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("何が起きた議案なのかが分かる本文を取る", () => {
    const report = find("報第5号");
    expect(report.numberKind).toBe("hou");
    expect(report.body).toContain("沼津市立第四小学校校舎建築主体工事");
    expect(report.body).toContain("９億2400万円");
    expect(report.body).toContain("９億3586万9000円");
  });

  it("事故の経緯まで含めて取る", () => {
    expect(find("報第1号").body).toContain(
      "グレーチング脇の鉄板にタイヤを取られ"
    );
  });

  it("契約議案は契約先と金額を含む", () => {
    const contract = find("議第17号");
    expect(contract.body).toContain(
      "沼津市民文化センター高圧受変電設備更新工事"
    );
    expect(contract.body).toContain("４億7905万円");
  });

  it("同じ議案の概要説明と詳細説明があれば、内容の厚い方を採る", () => {
    // 議第3号は市長が概要を、総務部長が詳細を説明している
    const settlement = find("議第3号");
    expect(settlement.body).toContain("静岡地方裁判所沼津支部");
    expect(settlement.body.length).toBeGreaterThan(300);
  });

  it("「報第1号から報第7号までは」のような一括の前置きは個別説明にしない", () => {
    // 前置きだけを拾うと本文が短くなる。詳細説明の方が採られていること
    expect(find("報第1号").body).toContain("内容といたしましては");
  });

  it("議案が説明されていないテキストでは空配列", () => {
    expect(extractBillExplanations("○議長（梶　泰久）\n休憩します。")).toEqual(
      []
    );
    expect(extractBillExplanations("")).toEqual([]);
  });
});

describe("extractDebates", () => {
  const debates = extractDebates(DEBATE);
  const forBill = (billNumber: string) =>
    debates.filter((d) => d.billNumber === billNumber);

  it("この日に討論があった議案を拾う", () => {
    const bills = new Set(debates.map((d) => d.billNumber));
    // 議会だよりの「賛否が分かれた議案一覧」と符合する議案
    expect(bills).toContain("議第30号");
    expect(bills).toContain("議第38号");
    expect(bills).toContain("議第39号");
    expect(bills).toContain("議第50号");
    expect(bills).toContain("議第53号");
  });

  it("反対討論の発言者と立場を正しく取る", () => {
    // 議第50号（新中間処理施設敷地造成工事の契約変更）は無所属1名が反対
    const against = forBill("議第50号").filter((d) => d.stance === "against");
    expect(against).toHaveLength(1);
    expect(against[0].speakerName).toBe("山下富美子");
    expect(against[0].seatNumber).toBe(18);
  });

  it("同じ議案の賛成討論と反対討論を両方取る", () => {
    const stances = forBill("議第50号").map((d) => d.stance);
    expect(stances).toContain("against");
    expect(stances).toContain("for");
  });

  it("「反対の立場から」という言い回しも反対として扱う", () => {
    // 議第30号は日本共産党の川口議員が「反対の立場から意見を述べます」と発言
    const kawaguchi = forBill("議第30号").find(
      (d) => d.speakerName === "川口　慶"
    );
    expect(kawaguchi?.stance).toBe("against");
    expect(kawaguchi?.seatNumber).toBe(1);
  });

  it("同じ議員が複数の議案に討論しても取り違えない", () => {
    const kawaguchi = debates.filter((d) => d.speakerName === "川口　慶");
    expect(kawaguchi.length).toBeGreaterThanOrEqual(5);
    // すべて反対の立場（日本共産党沼津市議団）
    expect(kawaguchi.every((d) => d.stance === "against")).toBe(true);
    // 議案番号がばらけていること（1件に寄せて誤対応していない）
    expect(new Set(kawaguchi.map((d) => d.billNumber)).size).toBe(
      kawaguchi.length
    );
  });

  it("賛成討論を反対と取り違えない", () => {
    const muraki = debates.find((d) => d.speakerName === "村木　豊");
    expect(muraki?.billNumber).toBe("議第30号");
    expect(muraki?.stance).toBe("for");
  });

  it("議席番号を半角の数値にする", () => {
    expect(
      debates.every((d) => d.seatNumber === null || d.seatNumber > 0)
    ).toBe(true);
  });

  it("同じ議員・同じ議案・同じ立場を重複させない", () => {
    const keys = debates.map(
      (d) => `${d.billNumber}:${d.speakerName}:${d.stance}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("討論がないテキストでは空配列", () => {
    expect(
      extractDebates("○議長（梶　泰久）\n討論の通告がありません。")
    ).toEqual([]);
    expect(extractDebates("")).toEqual([]);
  });
});
