#!/usr/bin/env node
/**
 * 「お金の流れ」試作ページの静的データを、沼津市の公式PDFから生成する。
 *
 * 使い方: node scripts/generate-spending-flow-data.mjs
 *
 * 公式の件数・合計と一致しないときは例外で止まり、データを書き出さない。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertRecipientTotals,
  assertSettlementMatrix,
  parseRecipientRows,
  parseRecipientTotals,
  parseRevenueItems,
  parseSettlementMatrix,
  parseTsvWords,
} from "./spending-flow-parser-utils.mjs";

const FISCAL_YEAR = 2024;
const BASE = `https://www.city.numazu.shizuoka.jp/shisei/gyozaisei/finance/kessan${FISCAL_YEAR}`;
const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  `../web/src/features/finance/shared/data/spending-flow-${FISCAL_YEAR}.json`
);

const PURPOSE_NAMES = [
  "議会費",
  "総務費",
  "民生費",
  "衛生費",
  "労働費",
  "農林水産業費",
  "商工費",
  "土木費",
  "消防費",
  "教育費",
  "災害復旧費",
  "公債費",
];

const RECIPIENT_LISTS = [
  {
    kind: "subsidy",
    title: "補助金一覧",
    url: `${BASE}/pdf/hojyokin.pdf`,
    layout: {
      department: 75,
      division: 118,
      category: 162,
      name: 184,
      recipient: 382,
      amount: 500,
    },
  },
  {
    kind: "burden",
    title: "負担金一覧",
    url: `${BASE}/pdf/futankin.pdf`,
    layout: {
      department: 84,
      division: 131,
      name: 176,
      recipient: 370,
      amount: 500,
    },
  },
  {
    kind: "grant",
    title: "交付金一覧",
    url: `${BASE}/pdf/koufukin.pdf`,
    layout: {
      department: 87,
      division: 138,
      name: 189,
      recipient: 348,
      amount: 500,
    },
  },
];

const REVENUE_SOURCE = {
  title: "一般会計決算（歳入）",
  url: `${BASE}/pdf/sainyu.pdf`,
};
const SETTLEMENT_SOURCE = {
  title: "市政報告書 附表（一般会計歳出決算節別集計表）",
  url: `${BASE}/pdf_houkoku/fuhyou.pdf`,
};

const workDir = mkdtempSync(path.join(tmpdir(), "spending-flow-"));

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

function findSettlementPage(filePath) {
  const pages = pdfToText(filePath, "-layout").split("\f");
  const index = pages.findIndex(
    (page) => page.includes("一般会計歳出決算") && page.includes("産業費")
  );
  if (index < 0) throw new Error("節別集計表のページが見つからない");
  return index + 1;
}

function readPageWords(filePath, page) {
  const pageArgument = String(page);
  return parseTsvWords(
    pdfToText(filePath, "-tsv", "-f", pageArgument, "-l", pageArgument)
  );
}

async function main() {
  const recipients = [];
  const kindTotals = {};
  for (const list of RECIPIENT_LISTS) {
    const words = parseTsvWords(pdfToText(await download(list.url), "-tsv"));
    const parsed = parseRecipientRows(words, list.layout);
    const totals = parseRecipientTotals(words);
    assertRecipientTotals(parsed, totals, list.title);
    kindTotals[list.kind] = totals;
    recipients.push(
      ...parsed.rows.map((row) => ({ kind: list.kind, ...row }))
    );
  }

  const revenue = parseRevenueItems(
    pdfToText(await download(REVENUE_SOURCE.url), "-layout")
  );

  const settlementPath = await download(SETTLEMENT_SOURCE.url);
  const page = findSettlementPage(settlementPath);
  const matrix = parseSettlementMatrix(
    readPageWords(settlementPath, page),
    readPageWords(settlementPath, page + 1)
  );
  assertSettlementMatrix(matrix);

  const data = {
    fiscalYear: FISCAL_YEAR,
    purposeNames: PURPOSE_NAMES,
    revenue,
    expenditureRows: matrix.rows.map((row) => ({
      name: row.name,
      amounts: row.amounts.slice(0, PURPOSE_NAMES.length),
    })),
    kindTotals,
    recipients,
    sources: [
      REVENUE_SOURCE,
      SETTLEMENT_SOURCE,
      ...RECIPIENT_LISTS.map(({ title, url }) => ({ title, url })),
    ],
  };
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${OUTPUT_PATH} に ${recipients.length} 件を書き出した`);
}

try {
  await main();
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
