import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertRecipientTotals,
  assertSettlementMatrix,
  normalizeText,
  parseRecipientRows,
  parseRecipientTotals,
  parseRevenueItems,
  parseTsvWords,
  splitOrganization,
} from "./spending-flow-parser-utils.mjs";

const LAYOUT = {
  department: 75,
  division: 118,
  category: 162,
  name: 184,
  recipient: 382,
  amount: 500,
};

function word(text, left, top, page = 1) {
  return { page, left, top, right: left + 20, text };
}

describe("normalizeText", () => {
  it("半角カナと全角英数字を揃える", () => {
    assert.equal(normalizeText("ｺﾐｭﾆﾃｨ  ＩＣＴ"), "コミュニティ ICT");
  });
});

describe("parseTsvWords", () => {
  it("語の行だけを座標付きで取り出す", () => {
    const tsv = [
      "level\tpage_num\tpar_num\tblock_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
      "4\t1\t0\t0\t0\t0\t1\t2\t3\t4\t-1\t",
      "5\t1\t0\t0\t0\t0\t10\t20\t30\t4\t100\t補助金",
    ].join("\n");
    assert.deepEqual(parseTsvWords(tsv), [
      { page: 1, left: 10, top: 20, right: 40, text: "補助金" },
    ]);
  });
});

describe("splitOrganization", () => {
  it("はみ出した課名を部から分ける", () => {
    assert.deepEqual(splitOrganization("市民福祉部こども未来創造課"), {
      department: "市民福祉部",
      division: "こども未来創造課",
    });
  });

  it("部が空欄の行は課だけを返す", () => {
    assert.deepEqual(splitOrganization("危機管理課"), {
      department: null,
      division: "危機管理課",
    });
  });
});

describe("parseRecipientRows", () => {
  const words = [
    word("1", 53, 100),
    word("政策推進部", 76, 100),
    word("政策企画課", 119, 100),
    word("事業費", 163, 100),
    word("移住", 185, 100),
    word("申請者", 383, 100),
    word("34,000", 520, 100),
    word("2", 53, 120),
    word("生活安心課", 119, 120),
    word("運営費", 163, 120),
    word("交通安全", 185, 120),
    word("連合会の", 383, 116),
    word("会議", 383, 126),
    word("6852", 530, 128),
    word("【端数調整】", 185, 140),
    word("1", 533, 140),
    word("金額", 450, 170),
    word("40,853", 520, 170),
    word("件数", 450, 180),
    word("2", 530, 180),
  ];

  it("折り返しの行を1件にまとめ、空欄の部を推測で埋めない", () => {
    const { rows, roundingAdjustmentThousandYen } = parseRecipientRows(
      words,
      LAYOUT
    );
    assert.equal(roundingAdjustmentThousandYen, 1);
    assert.deepEqual(rows[1], {
      no: 2,
      department: null,
      division: "生活安心課",
      category: "運営費",
      name: "交通安全",
      recipient: "連合会の会議",
      amountThousandYen: 6852,
    });
  });

  it("端数調整を含めて公式の合計と照合する", () => {
    const parsed = parseRecipientRows(words, LAYOUT);
    const totals = parseRecipientTotals(words);
    assert.deepEqual(totals, { amountThousandYen: 40853, count: 2 });
    assert.doesNotThrow(() => assertRecipientTotals(parsed, totals, "補助金"));
    assert.throws(
      () =>
        assertRecipientTotals(parsed, { ...totals, count: 3 }, "補助金"),
      /公式の合計と一致しない/
    );
  });

  it("番号と金額の数が合わないページは例外にする", () => {
    const broken = words.filter((item) => item.text !== "34,000");
    assert.throws(() => parseRecipientRows(broken, LAYOUT), /数が合わない/);
  });
});

describe("parseRevenueItems", () => {
  it("収入済額を読み、減額の行も拾う", () => {
    const text = [
      "1 市税                    33,500,000   34,113,138       613,138    101.8    35.4",
      "2 地方譲与税                   525,000      481,872      △ 43,128     91.8     0.5",
      "区分",
    ].join("\n");
    assert.deepEqual(parseRevenueItems(text), [
      { code: 1, name: "市税", amountThousandYen: 34113138 },
      { code: 2, name: "地方譲与税", amountThousandYen: 481872 },
    ]);
  });
});

describe("assertSettlementMatrix", () => {
  const matrix = {
    rows: [
      { name: "報酬", amounts: [1, 2, 3] },
      { name: "給料", amounts: [4, 5, 9] },
    ],
    totals: [5, 7, 12],
  };

  it("行と列の合計が揃えば通す", () => {
    assert.doesNotThrow(() => assertSettlementMatrix(matrix));
  });

  it("列の合計が違えば例外にする", () => {
    assert.throws(
      () => assertSettlementMatrix({ ...matrix, totals: [6, 7, 12] }),
      /合計が一致しない/
    );
  });
});
