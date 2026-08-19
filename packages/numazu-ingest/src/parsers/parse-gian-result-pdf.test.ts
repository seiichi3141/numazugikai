import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ParsedBill } from "../shared/types";
import { parseGianResultPdf } from "./parse-gian-result-pdf";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

/** `pdftotext -layout` にかけた実物のPDFテキストを読む */
function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, `${name}.txt`), "utf-8");
}

function findBill(
  bills: readonly ParsedBill[],
  billNumber: string
): ParsedBill {
  const found = bills.find((bill) => bill.billNumber === billNumber);
  if (!found) throw new Error(`${billNumber} が見つからない`);
  return found;
}

function countByCategory(bills: readonly ParsedBill[]): Record<string, number> {
  return bills.reduce<Record<string, number>>((acc, bill) => {
    acc[bill.category] = (acc[bill.category] ?? 0) + 1;
    return acc;
  }, {});
}

describe("parseGianResultPdf: 令和8年6月定例会（第13回）", () => {
  const result = parseGianResultPdf(loadFixture("gian-0806"));

  it("会期の見出しから回次と元号を読み取る", () => {
    expect(result.sessionNumber).toBe(13);
    expect(result.sessionLabel).toBe("第13回（令和８年６月）定例会");
    expect(result.era).toBe("令和");
  });

  it("PDF上のすべての議案を取りこぼさない", () => {
    // PDF本文に現れる議案番号は50件（議第19・報第8・認第21・発議第2）
    expect(result.bills).toHaveLength(50);
    expect(countByCategory(result.bills)).toEqual({
      ordinance: 11,
      budget: 2,
      contract: 4,
      report: 8,
      personnel: 21,
      other: 2,
      opinion_paper: 2,
    });
  });

  it("条例の議案を全項目そろえて取る", () => {
    expect(findBill(result.bills, "議第58号")).toEqual({
      billNumber: "議第58号",
      numberKind: "gi",
      numberValue: 58,
      title: "沼津市印鑑条例の一部改正",
      category: "ordinance",
      legalBasis: "地方自治法第96条第1項第1号",
      submittedOn: "2026-06-05",
      submitter: "mayor",
      committee: "民生病院教育",
      committeeResult: "可決すべきもの",
      decidedOn: "2026-06-29",
      decision: "passed",
    });
  });

  it("予算の議案は根拠条項が予算のものになる", () => {
    const budget = findBill(result.bills, "議第67号");
    expect(budget.title).toBe("令和８年度沼津市一般会計補正予算（第２回）");
    expect(budget.category).toBe("budget");
    expect(budget.legalBasis).toBe("地方自治法第96条第1項第2号");
    expect(budget.committee).toBe("一般会計予算決算");
  });

  it("報告は委員会付託がなく、報告日を議決日として持つ", () => {
    const report = findBill(result.bills, "報第14号");
    expect(report.title).toBe("専決処分の報告（道路事故損害賠償額の決定）");
    expect(report.category).toBe("report");
    expect(report.numberKind).toBe("hou");
    expect(report.committee).toBeNull();
    expect(report.committeeResult).toBeNull();
    expect(report.submittedOn).toBe("2026-06-05");
    expect(report.decidedOn).toBe("2026-06-17");
    expect(report.decision).toBe("reported");
  });

  it("人事案件は付託省略・同意として取る", () => {
    const personnel = findBill(result.bills, "認第11号");
    expect(personnel.title).toBe("監査委員の選任（間野 𠮷幸）");
    expect(personnel.category).toBe("personnel");
    expect(personnel.committee).toBe("省略");
    // 付託を省略した場合、審査結果欄は "-" なので null にする
    expect(personnel.committeeResult).toBeNull();
    expect(personnel.decision).toBe("consented");
  });

  it("議員提出議案は提出者を議員として取る", () => {
    const hatsugi = findBill(result.bills, "発議第4号");
    expect(hatsugi.title).toBe("永年勤続議員に対する感謝状の贈呈");
    expect(hatsugi.numberKind).toBe("hatsugi");
    expect(hatsugi.submitter).toBe("member");
    expect(hatsugi.decision).toBe("passed");
  });
});

describe("parseGianResultPdf: 令和8年2月定例会（第12回）", () => {
  const result = parseGianResultPdf(loadFixture("gian-0802"));

  it("PDF上のすべての議案を取りこぼさない", () => {
    expect(result.sessionNumber).toBe(12);
    expect(result.bills).toHaveLength(71);
  });

  it("2行に折り返した議案名を、余計な空白を挟まずつなぐ", () => {
    // PDF上は「…補正予算（第」/「８回））」と2行に分かれている
    const wrapped = findBill(result.bills, "認第1号");
    expect(wrapped.title).toBe(
      "専決処分の報告及びその承認（令和７年度沼津市一般会計補正予算（第８回））"
    );
    expect(wrapped.category).toBe("provisional_approval");
    expect(wrapped.legalBasis).toBe("地方自治法第179条関係");
    expect(wrapped.committee).toBe("一般会計予算決算");
    expect(wrapped.committeeResult).toBe("承認すべきもの");
    expect(wrapped.decision).toBe("approved");
  });

  it("折り返しが単語の途中でも欠落・重複させない", () => {
    // 「…について、山」/「下議員及び市に…」→「山下議員」に戻ること
    const resolution = findBill(result.bills, "発議第1号");
    expect(resolution.title).toBe(
      "令和８年３月13日に和解が成立した不当利得返還請求事件について、山下議員及び市に説明責任の履行を求める決議"
    );
    expect(resolution.submitter).toBe("member");
    expect(resolution.submittedOn).toBe("2026-03-17");
    expect(resolution.decidedOn).toBe("2026-03-17");
  });

  it("会期途中の追加提出議案は提出日が異なる", () => {
    expect(findBill(result.bills, "議第52号").submittedOn).toBe("2026-02-27");
    expect(findBill(result.bills, "議第1号").submittedOn).toBe("2026-02-06");
  });
});

describe("parseGianResultPdf: 令和6年11月定例会（第7回）", () => {
  const result = parseGianResultPdf(loadFixture("gian-0611"));

  it("会期の見出しの全角数字を読み取る", () => {
    expect(result.sessionNumber).toBe(7);
    expect(result.sessionLabel).toBe("第７回（令和６年11月）定例会");
  });

  it("PDF上のすべての議案を取りこぼさない", () => {
    expect(result.bills).toHaveLength(27);
  });

  it("委員会再編前の旧委員会名もそのまま取れる", () => {
    // 令和6年当時は「総務」「民生病院」「建設水道」。名称の一覧を持たずに拾えること
    const committees = new Set(
      result.bills.map((bill) => bill.committee).filter(Boolean)
    );
    expect(committees).toContain("総務");
    expect(committees).toContain("民生病院");
    expect(committees).toContain("建設水道");
  });

  it("元号を跨いでも西暦に正しく変換する", () => {
    expect(findBill(result.bills, "議第78号").submittedOn).toBe("2024-11-22");
  });
});

describe("parseGianResultPdf: 異常系", () => {
  it("空文字を渡しても落ちない", () => {
    expect(parseGianResultPdf("")).toEqual({
      sessionNumber: null,
      sessionLabel: null,
      era: null,
      year: null,
      month: null,
      bills: [],
    });
  });

  it("議案が1件もないテキストでは空配列を返す", () => {
    const result = parseGianResultPdf(
      "第13回（令和８年６月）定例会\n\n① 議案審議\n"
    );
    expect(result.sessionNumber).toBe(13);
    expect(result.bills).toEqual([]);
  });

  it("見出し行を議案として拾わない", () => {
    const text = [
      "第13回（令和８年６月）定例会",
      "●条例 （地方自治法第96条第1項第1号）",
      "                          提出日        委員会        年月日",
      "議案番号        議案名     提出          付託          議決",
      "                          提出者       審査結果       審議結果",
    ].join("\n");
    expect(parseGianResultPdf(text).bills).toEqual([]);
  });
});

describe("parseGianResultPdf: 見出しからの年月", () => {
  it("令和8年6月定例会の年月を西暦に直す", () => {
    const result = parseGianResultPdf(loadFixture("gian-0806"));
    expect(result.year).toBe(2026);
    expect(result.month).toBe(6);
  });

  it("全角の元号年も読み取る", () => {
    const result = parseGianResultPdf(loadFixture("gian-0611"));
    expect(result.year).toBe(2024);
    expect(result.month).toBe(11);
  });

  it("見出しがなければ null", () => {
    expect(parseGianResultPdf("")).toMatchObject({ year: null, month: null });
  });
});
