#!/usr/bin/env node
/**
 * 「事業の予算と実績」試作ページの静的データを、沼津市の公式PDFから生成する。
 *
 * 使い方: node scripts/generate-project-budget-data.mjs
 * `spending-flow-2024.json` を先に生成しておくこと。
 *
 * 資料の合計や財源内訳と一致しないときは例外で止まり、データを書き出さない。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertBudgetDetail,
  contractQuery,
  findBestBudgetItem,
  isPublishableParty,
  mergeConstructions,
  parseBudgetDetail,
  parseConstructionRows,
  parseContractRows,
} from "./project-budget-parser-utils.mjs";
import { parseTsvWords } from "./spending-flow-parser-utils.mjs";

const FISCAL_YEAR = 2024;
const FINANCE_BASE =
  "https://www.city.numazu.shizuoka.jp/shisei/gyozaisei/finance";
const CONTRACT_BASE =
  "https://www.city.numazu.shizuoka.jp/business/nyusatsu_keiyaku/nyusatsu/buppin/zuii/doc";
const DATA_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../web/src/features/finance/shared/data"
);
const OUTPUT_PATH = path.join(DATA_DIR, `project-budget-${FISCAL_YEAR}.json`);
const FLOW_PATH = path.join(DATA_DIR, `spending-flow-${FISCAL_YEAR}.json`);

const PURPOSES = [
  [1, "議会費"],
  [2, "総務費"],
  [3, "民生費"],
  [4, "衛生費"],
  [5, "労働費"],
  [6, "農林水産業費"],
  [7, "商工費"],
  [8, "土木費"],
  [9, "消防費"],
  [10, "教育費"],
  [11, "災害復旧費"],
  [12, "公債費"],
  [13, "予備費"],
];
const BUDGET_DETAIL_URL = (code) =>
  `${FINANCE_BASE}/yosan${FISCAL_YEAR}/gaiyousho/pdf/i-${code}.pdf`;
const BUDGET_CONSTRUCTION_URL = `${FINANCE_BASE}/yosan${FISCAL_YEAR}/gaiyousho/pdf/s-10.pdf`;
const SETTLEMENT_APPENDIX_URL = `${FINANCE_BASE}/kessan${FISCAL_YEAR}/pdf_houkoku/fuhyou.pdf`;
const CONTRACT_FILES = ["r0604", "r0607", "r0610", "r0701"];
const CONTRACT_URL = (file) => `${CONTRACT_BASE}/${file}.pdf`;

/** 右側の財源の列を除いて読む範囲（pt）。 */
const BUDGET_CROP = ["-x", "0", "-y", "0", "-W", "655", "-H", "1300"];
const CONSTRUCTION_LAYOUTS = {
  budget: {
    bodyTop: 165,
    nameLeft: 150,
    nameRight: 256,
    amountRight: 305,
    summaryLeft: 576,
  },
  settlement: {
    bodyTop: 118,
    nameLeft: 125,
    nameRight: 215,
    amountRight: 270,
    summaryLeft: 380,
  },
};
/** 人件費と物件費は事業ごとの内容を示さないので一覧に載せない。 */
const EXCLUDED_ROWS = new Set(["人件費", "物件費"]);
/** これ未満の一致度は別の事業へ結び付けるおそれが大きいので採用しない。 */
const MIN_LINK_SCORE = 0.6;
const THOUSAND = 1000;

const workDir = mkdtempSync(path.join(tmpdir(), "project-budget-"));

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} が ${response.status} を返した`);
  const filePath = path.join(workDir, path.basename(url));
  writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
  return filePath;
}

function pdfToText(filePath, ...args) {
  return execFileSync("pdftotext", [...args, filePath, "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function loadBudgetItems() {
  const items = [];
  let budgetTotalThousandYen = 0;
  for (const [code, purpose] of PURPOSES) {
    const filePath = await download(BUDGET_DETAIL_URL(code));
    const parsed = parseBudgetDetail(
      pdfToText(filePath, "-layout", ...BUDGET_CROP)
    );
    assertBudgetDetail(parsed, purpose);
    budgetTotalThousandYen += parsed.purposeTotal;
    items.push(
      ...parsed.items
        .filter((item) => !EXCLUDED_ROWS.has(item.name))
        .map(({ kou, section, ...item }) => ({ purpose, ...item }))
    );
  }
  return {
    budgetTotalThousandYen,
    items: items
      .sort((a, b) => b.amountThousandYen - a.amountThousandYen)
      .map((item, index) => ({ id: index + 1, ...item })),
  };
}

function constructionPages(filePath) {
  const pages = pdfToText(filePath, "-layout").split("\f");
  return pages.flatMap((page, index) =>
    /事\s*業\s*名/.test(page) ? [index + 1] : []
  );
}

function readConstruction(filePath, layout, label) {
  const pages = constructionPages(filePath);
  const words = pages.flatMap((page) =>
    parseTsvWords(pdfToText(filePath, "-tsv", "-f", `${page}`, "-l", `${page}`))
  );
  return parseConstructionRows(words, layout, label);
}

function linkOf(item, query, options) {
  const best = findBestBudgetItem(item, query, options);
  return best && best.score >= MIN_LINK_SCORE ? best.item.id : null;
}

async function main() {
  const { items, budgetTotalThousandYen } = await loadBudgetItems();

  const budgetRows = readConstruction(
    await download(BUDGET_CONSTRUCTION_URL),
    CONSTRUCTION_LAYOUTS.budget,
    "主要建設事業（予算）"
  );
  const settlementRows = readConstruction(
    await download(SETTLEMENT_APPENDIX_URL),
    CONSTRUCTION_LAYOUTS.settlement,
    "主要建設事業（決算）"
  );
  const constructions = mergeConstructions(settlementRows, budgetRows, items);

  const contractRows = [];
  for (const file of CONTRACT_FILES) {
    const filePath = await download(CONTRACT_URL(file));
    contractRows.push(...parseContractRows(parseTsvWords(pdfToText(filePath, "-tsv"))));
  }
  // 締結日が読めない行は、名称と相手方の列を分けられない
  if (contractRows.some((row) => !row.contractedOn)) {
    throw new Error("締結日を読めない契約がある");
  }
  const contracts = contractRows.map((row) => ({
    ...row,
    party: isPublishableParty(row.party) ? row.party : null,
    itemId: linkOf(items, contractQuery(row.name), {
      department: row.department,
      ...(row.amountYen === null
        ? {}
        : { amountThousandYen: row.amountYen / THOUSAND }),
    }),
  }));

  const flow = JSON.parse(readFileSync(FLOW_PATH, "utf8"));
  const recipientLinks = flow.recipients.flatMap((row) => {
    const counterparty =
      row.recipient && row.recipient !== "申請者" ? ` ${row.recipient}` : "";
    const itemId = linkOf(items, `${row.name}${counterparty}`, {
      department: row.department,
    });
    return itemId === null ? [] : [{ kind: row.kind, no: row.no, itemId }];
  });

  const data = {
    fiscalYear: FISCAL_YEAR,
    items,
    budgetTotalThousandYen,
    constructions,
    contracts,
    recipientLinks,
    sources: [
      ...PURPOSES.map(([code, purpose]) => ({
        title: `令和6年度 歳入歳出予算の概要書（${purpose}）`,
        url: BUDGET_DETAIL_URL(code),
      })),
      {
        title: "令和6年度 一般会計主要建設事業一覧表（予算）",
        url: BUDGET_CONSTRUCTION_URL,
      },
      {
        title: "令和6年度 市政報告書 附表（一般会計主要建設事業一覧表）",
        url: SETTLEMENT_APPENDIX_URL,
      },
      ...CONTRACT_FILES.map((file, index) => ({
        title: `令和6年度 随意契約一覧表（第${index + 1}四半期）`,
        url: CONTRACT_URL(file),
      })),
    ],
  };
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`);
  const linkedContracts = contracts.filter((row) => row.itemId !== null);
  console.log(
    JSON.stringify({
      items: items.length,
      constructions: constructions.length,
      constructionsWithBudget: constructions.filter(
        (row) => row.budgetThousandYen !== null
      ).length,
      contracts: contracts.length,
      contractYen: contracts.reduce((sum, row) => sum + (row.amountYen ?? 0), 0),
      linkedContracts: linkedContracts.length,
      linkedContractYen: linkedContracts.reduce(
        (sum, row) => sum + (row.amountYen ?? 0),
        0
      ),
      hiddenParties: contracts.filter((row) => row.party === null).length,
      recipientLinks: recipientLinks.length,
    })
  );
}

try {
  await main();
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
