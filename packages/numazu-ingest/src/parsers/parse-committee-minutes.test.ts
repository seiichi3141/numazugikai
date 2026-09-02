import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { amivoiceHtmlToText } from "./parse-amivoice-html";
import { extractCommitteeBillReviews } from "./parse-committee-minutes";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

// 令和8年6月19日 民生病院教育委員会（令和8年6月定例会の付託審査）の実物
const MINUTES = amivoiceHtmlToText(
  readFileSync(join(FIXTURES, "amivoice-committee-minutes.html"), "utf-8")
);

describe("extractCommitteeBillReviews: 実際の委員会会議記録", () => {
  const reviews = extractCommitteeBillReviews(MINUTES);
  const find = (billNumber: string) => {
    const found = reviews.find((r) => r.billNumbers.includes(billNumber));
    if (!found) throw new Error(`${billNumber} の審査が見つからない`);
    return found;
  };

  it("付託された議案の審査をすべて取る", () => {
    const numbers = reviews.flatMap((r) => r.billNumbers);
    // この日の付託は議第58・61・62・63・65・69号
    for (const n of [
      "議第58号",
      "議第61号",
      "議第62号",
      "議第63号",
      "議第65号",
      "議第69号",
    ]) {
      expect(numbers).toContain(n);
    }
  });

  it("課長による説明を取る。本会議より具体的で市民向け解説の材料になる", () => {
    const review = find("議第58号");
    expect(review.explanation).toContain("印鑑条例");
    // 「コンビニのマルチコピー機で使えるカードが増える」ことまで説明されている
    expect(review.explanation).toContain("特定在留カード");
    expect(review.explanation).toContain("コンビニ");
    expect(review.explanation).toContain("マイナンバーカード");
  });

  it("委員の質疑の回数を数える", () => {
    // 質疑が活発だった議案とそうでない議案の差が事実として残る
    expect(find("議第69号").questionCount).toBeGreaterThan(10);
    expect(find("議第62号").questionCount).toBe(0);
  });

  it("委員の発言を説明に混ぜない", () => {
    const review = find("議第58号");
    // 加藤委員の質疑の文言が説明に入っていないこと
    expect(review.explanation).not.toContain("ワンストップ");
  });

  it("審査記録がないテキストでは空配列", () => {
    expect(extractCommitteeBillReviews("")).toEqual([]);
    expect(
      extractCommitteeBillReviews("○委員長\n本日の日程をお知らせします。")
    ).toEqual([]);
  });
});

describe("extractCommitteeBillReviews: 説明を省略して質疑だけ行う議題", () => {
  it("予算審査のように説明なしで質疑が始まっても審査として拾う", () => {
    const text = [
      "○委員長",
      "最初に、議第39号　令和８年度沼津市一般会計予算を議題といたします。",
      "御質疑を伺います。",
      "",
      "○山田委員",
      "歳出のうち子育て支援費について伺います。",
      "",
      "○財政課長",
      "御質問の子育て支援費は前年度比で増額しております。",
      "",
      "○山田委員",
      "増額の内訳を伺います。",
    ].join("\n");

    const reviews = extractCommitteeBillReviews(text);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].billNumbers).toEqual(["議第39号"]);
    expect(reviews[0].questionCount).toBe(2);
    expect(reviews[0].explanation).toBe("");
  });

  it("議題の宣告だけで説明も質疑もない場合は審査とみなさない", () => {
    const text = [
      "○委員長",
      "議第1号　市道路線の廃止を議題といたします。",
      "本日はここまでといたします。",
    ].join("\n");
    expect(extractCommitteeBillReviews(text)).toEqual([]);
  });
});
