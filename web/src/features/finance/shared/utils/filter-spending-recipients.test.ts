import { describe, expect, it } from "vitest";
import type { SpendingRecipient } from "../types/spending-flow";
import { filterSpendingRecipients } from "./filter-spending-recipients";

const base: SpendingRecipient = {
  kind: "subsidy",
  no: 1,
  department: "市民福祉部",
  division: "健康づくり課",
  category: "運営費",
  name: "医師会運営事業費補助金",
  recipient: "一般社団法人沼津医師会",
  amountThousandYen: 100,
};

const rows: SpendingRecipient[] = [
  base,
  {
    ...base,
    kind: "burden",
    no: 2,
    name: "消防組合負担金",
    recipient: "駿東伊豆消防組合",
    department: null,
    division: "危機管理課",
    amountThousandYen: 900,
  },
  { ...base, no: 3, name: "移住支援金", recipient: null, amountThousandYen: 5 },
];

describe("filterSpendingRecipients", () => {
  it("金額の大きい順に並べる", () => {
    expect(
      filterSpendingRecipients(rows, "all", "").map((row) => row.no)
    ).toEqual([2, 1, 3]);
  });

  it("種類で絞り込む", () => {
    expect(
      filterSpendingRecipients(rows, "burden", "").map((row) => row.no)
    ).toEqual([2]);
  });

  it("交付先・部課の空欄があってもキーワードで探せる", () => {
    expect(
      filterSpendingRecipients(rows, "all", "移住").map((row) => row.no)
    ).toEqual([3]);
    expect(
      filterSpendingRecipients(rows, "all", "健康づくり").map((row) => row.no)
    ).toEqual([1, 3]);
  });

  it("入力の全角英数字を揃えて検索する", () => {
    const withLatin = [{ ...base, name: "ICT推進負担金" }];
    expect(filterSpendingRecipients(withLatin, "all", "ＩＣＴ")).toHaveLength(
      1
    );
  });

  it("元の配列を並べ替えない", () => {
    const original = [...rows];
    filterSpendingRecipients(rows, "all", "");
    expect(rows).toEqual(original);
  });
});
