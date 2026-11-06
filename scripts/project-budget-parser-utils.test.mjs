import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBudgetDetail,
  buildGrams,
  contractQuery,
  findBestBudgetItem,
  isPublishableParty,
  mergeConstructions,
  parseBudgetDetail,
  parseConstructionRows,
  parseContractRows,
  restoreMisencodedDigits,
} from "./project-budget-parser-utils.mjs";

const encode = (text) =>
  [...text]
    .map((character) =>
      /[\d,]/.test(character)
        ? String.fromCharCode(character.charCodeAt(0) + 0x3eac)
        : character
    )
    .join("");

const BUDGET_TEXT = `
1 衛   生   費        300            10
1 保健衛生費                    300     前年度比      10 増
              1   保健衛生総務費               200     前年度比     5 増
                  ○一    般       経   費        50
                   ・人           件           費     50   （職員）
                  ○事        業       費       150
                   ・ 健康診査事業費             100   （妊婦健康診査、
                                                       産婦健康診査ほか）
                   ・ 母子教育相談・乳幼児健康診  50   （乳幼児健康診査
                     査事業費
              2   予防費                       100     前年度と同額
                  ○一    般       経   費
                   ・委           託           料     100   （予防接種）
`;

test("restoreMisencodedDigits は誤写像された数字を戻す", () => {
  assert.equal(restoreMisencodedDigits(encode("1,234")), "1,234");
});

test("parseBudgetDetail は目と事業を読み、折り返した事業名をつなぐ", () => {
  const parsed = parseBudgetDetail(encode(BUDGET_TEXT));
  assert.equal(parsed.purposeTotal, 300);
  assert.deepEqual(
    parsed.items.map((item) => item.name),
    ["人件費", "健康診査事業費", "母子教育相談・乳幼児健康診査事業費", "委託料"]
  );
  assert.equal(parsed.items[1].note, "妊婦健康診査、産婦健康診査ほか");
  assert.equal(parsed.sections[1].general, 100);
  assert.doesNotThrow(() => assertBudgetDetail(parsed, "衛生費"));
});

test("assertBudgetDetail は目の合計と款の合計の不一致で止まる", () => {
  const parsed = parseBudgetDetail(encode(BUDGET_TEXT));
  parsed.purposeTotal = 299;
  assert.throws(() => assertBudgetDetail(parsed, "衛生費"), /款の合計/);
  parsed.purposeTotal = null;
  assert.throws(() => assertBudgetDetail(parsed, "衛生費"), /読めない/);
});

test("assertBudgetDetail は内訳の不一致で止まる", () => {
  const parsed = parseBudgetDetail(encode(BUDGET_TEXT));
  parsed.items[0].amountThousandYen = 1;
  parsed.sections[0].generalRows = 1;
  assert.throws(() => assertBudgetDetail(parsed, "衛生費"), /内訳が合わない/);
});

const word = (text, left, top, page = 1) => ({
  page,
  left,
  top,
  right: left + text.length * 8,
  text,
});
const CONSTRUCTION_LAYOUT = {
  bodyTop: 100,
  nameLeft: 120,
  nameRight: 215,
  amountRight: 270,
  summaryLeft: 380,
};

test("parseConstructionRows は名前を近い金額行に割り当て、財源を検算する", () => {
  const rows = parseConstructionRows(
    [
      word("事業名", 130, 60),
      word("保健センター", 125, 150),
      word("整備事業", 125, 165),
      word("38,170", 220, 150),
      word("35,686", 285, 150),
      word("2,484", 335, 150),
      word("―", 300, 400),
      word("234", 310, 400),
      word("―", 330, 400),
    ],
    CONSTRUCTION_LAYOUT,
    "テスト"
  );
  assert.deepEqual(rows, [
    { name: "保健センター整備事業", amountThousandYen: 38170 },
  ]);
});

test("parseConstructionRows は財源の合計が違うと止まる", () => {
  assert.throws(
    () =>
      parseConstructionRows(
        [
          word("事業", 125, 150),
          word("100", 225, 150),
          word("90", 285, 150),
        ],
        CONSTRUCTION_LAYOUT,
        "テスト"
      ),
    /財源の合計/
  );
});

test("parseContractRows は締結日を境に名称と相手方を分け、住所と理由を除く", () => {
  const rows = parseContractRows([
    word("契約担当部課", 79, 82),
    word("契約名称", 147, 82),
    word("契約締結日", 212, 82),
    word("契約の相手方", 287, 82),
    word("契約金額", 370, 82),
    word("随意契約の理由", 517, 82),
    word("総務部", 70, 98),
    word("1", 58, 103),
    word("人事課", 70, 108),
    word("健康診断業務委託", 120, 103),
    word("令和6年4月26日", 205, 103),
    word("公益財団法人予防協会", 256, 98),
    word("静岡市駿河区丸子186-5", 256, 108),
    word("10,786,490円", 365, 103),
    word("相手方しかできないため。", 420, 103),
  ]);
  assert.deepEqual(rows, [
    {
      department: "総務部人事課",
      name: "健康診断業務委託",
      party: "公益財団法人予防協会",
      contractedOn: "令和6年4月26日",
      amountYen: 10786490,
    },
  ]);
});

test("parseContractRows は全角の住所と想定額を相手方から除き、総額なしは null にする", () => {
  const [row] = parseContractRows([
    word("契約担当部課", 79, 82),
    word("契約名称", 147, 82),
    word("契約締結日", 212, 82),
    word("契約の相手方", 287, 82),
    word("契約金額", 370, 82),
    word("随意契約の理由", 517, 82),
    word("総務部", 70, 103),
    word("1", 58, 103),
    word("配食業務委託", 120, 103),
    word("令和6年4月1日", 205, 103),
    word("単価契約株式会社沼津想定額", 256, 98),
    word("静岡市葵区紺屋町１－１", 256, 108),
  ]);
  assert.equal(row.party, "株式会社沼津");
  assert.equal(row.amountYen, null);
});

test("parseContractRows は全角の日付を読み、単価より総額を採る", () => {
  const [row] = parseContractRows([
    word("契約担当部課", 79, 82),
    word("契約名称", 147, 82),
    word("契約締結日", 212, 82),
    word("契約の相手方", 287, 82),
    word("契約金額", 370, 82),
    word("随意契約の理由", 517, 82),
    word("教育部", 70, 103),
    word("1", 58, 103),
    word("給食用物資", 120, 103),
    word("令和６年10月15日", 205, 103),
    word("株式会社沼津", 256, 103),
    word("2,415円", 365, 98),
    word("1,487,291円", 365, 108),
  ]);
  assert.equal(row.contractedOn, "令和6年10月15日");
  assert.equal(row.amountYen, 1487291);
});

test("isPublishableParty は個人と判別不能な文字列を伏せる", () => {
  assert.equal(isPublishableParty("株式会社沼津"), true);
  assert.equal(isPublishableParty("沼津 太郎"), false);
  assert.equal(isPublishableParty("岡支店"), false);
  assert.equal(isPublishableParty(`株式会社${"あ".repeat(30)}`), false);
});

test("buildGrams は定型語をまたがない", () => {
  const grams = buildGrams("令和6年度沼津市健康診査業務委託");
  assert.ok(grams.has("健康診"));
  assert.ok(![...grams].some((gram) => gram.includes("業")));
});

test("contractQuery は半角と全角の括弧書きを除く", () => {
  assert.equal(contractQuery("尿検査業務委託(小・中学校分)（前期）"), "尿検査業務委託");
});

test("mergeConstructions は金額が一致する事業にだけ決算を結び付ける", () => {
  const items = [
    { id: 1, name: "河川維持事業費", amountThousandYen: 170 },
    { id: 2, name: "消防庁舎整備事業費（本部）", amountThousandYen: 90 },
  ];
  const merged = mergeConstructions(
    [
      { name: "河川維持事業", amountThousandYen: 168 },
      { name: "消防庁舎整備事業(本部)", amountThousandYen: 80 },
      { name: "県営事業", amountThousandYen: 5 },
    ],
    [{ name: "河川維持事業", amountThousandYen: 450 }],
    items
  );
  assert.deepEqual(merged, [
    {
      name: "河川維持事業",
      itemId: null,
      budgetThousandYen: 450,
      settledThousandYen: 168,
    },
    {
      name: "消防庁舎整備事業(本部)",
      itemId: 2,
      budgetThousandYen: 90,
      settledThousandYen: 80,
    },
    {
      name: "県営事業",
      itemId: null,
      budgetThousandYen: null,
      settledThousandYen: 5,
    },
  ]);
});

const budgetItem = (name, purpose, amountThousandYen, note = "") => ({
  name,
  purpose,
  amountThousandYen,
  note,
});

test("findBestBudgetItem は最も近い事業を返す", () => {
  const best = findBestBudgetItem(
    [
      budgetItem("放課後児童クラブ運営事業費", "民生費", 1000),
      budgetItem("児童遊園管理事業費", "民生費", 1000),
    ],
    "放課後児童クラブ運営事業業務委託"
  );
  assert.equal(best.item.name, "放課後児童クラブ運営事業費");
});

test("findBestBudgetItem は担当部の款と金額で候補を絞る", () => {
  const items = [budgetItem("妊婦健康診査事業費", "衛生費", 100)];
  const query = "妊婦健康診査事業業務委託";
  assert.equal(
    findBestBudgetItem(items, query, { department: "教育委員会" }),
    null
  );
  assert.equal(
    findBestBudgetItem(items, query, { amountThousandYen: 131 }),
    null
  );
  assert.ok(findBestBudgetItem(items, query, { amountThousandYen: 130 }));
});
