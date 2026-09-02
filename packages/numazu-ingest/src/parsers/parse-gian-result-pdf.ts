import {
  COMMITTEE_RESULT_PATTERN,
  DECISIONS,
  SECTION_CATEGORIES,
  SUBMITTERS,
} from "../shared/constants";
import type {
  BillCategory,
  BillDecision,
  BillSubmitter,
  ParsedBill,
  ParsedGianResult,
} from "../shared/types";
import {
  KNOWN_ERAS,
  looksLikeWarekiDate,
  normalizeWarekiDate,
  toHalfWidthDigits,
} from "./normalize-wareki";
import { parseBillNumber, stripBillNumberPrefix } from "./parse-bill-number";

/**
 * 沼津市議会「議案審議結果」PDF を `pdftotext -layout` にかけたテキストを解析する。
 *
 * PDFは1件の議案を3行で表す。議案番号の行を中心に、前後1行ずつが1レコードになる。
 *
 *   ケースA（議案名が1行に収まる）
 *     行1:            8.2.6    建設水道危機管理    8.2.24   ← 提出日 / 付託委員会 / 議決日
 *     行2: 議第1号 市道路線の廃止
 *     行3:            市長      可決すべきもの      可決     ← 提出者 / 審査結果 / 審議結果
 *
 *   ケースB（議案名が折り返す）
 *     行1: 専決処分の報告及びその承認（… 8.2.6  一般会計予算決算  8.2.24
 *     行2: 認第1号
 *     行3: ８回））                市長    承認すべきもの      承認
 *
 *   ケースC（報告セクション。委員会付託がない）
 *     行1:            8.2.6
 *     行2: 報第1号 専決処分の報告（道路事故損害賠償額の決定）        8.2.9
 *     行3:            市長
 *
 * いずれも「日付」「提出者」「審査結果」「審議結果」を手がかりに列を特定し、
 * それらに当てはまらないセルを議案名の断片として拾う。列の座標には依存しない。
 */
export function parseGianResultPdf(text: string): ParsedGianResult {
  const lines = text.replace(/\f/g, "\n").split("\n");
  const header = parseSessionHeader(lines);

  const bills: ParsedBill[] = [];
  let section: SectionContext = { category: "other", legalBasis: null };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const parsedSection = parseSectionHeader(line);
    if (parsedSection) {
      section = parsedSection;
      continue;
    }

    if (!parseBillNumber(line)) continue;

    const bill = parseRecord(
      lines[i - 1] ?? "",
      line,
      lines[i + 1] ?? "",
      header.era,
      section
    );
    if (bill) bills.push(bill);
  }

  return { ...header, bills };
}

/** 元号ごとの元年の西暦 */
function eraBaseYear(era: string): number {
  return { 令和: 2019, 平成: 1989, 昭和: 1926 }[era] ?? 0;
}

type SectionContext = {
  category: BillCategory;
  legalBasis: string | null;
};

type Cell = string;

/** 2つ以上の連続空白で区切ってセルに分解する。全角空白も空白として扱う。 */
function splitCells(line: string): Cell[] {
  return line
    .replace(/　/g, "  ")
    .split(/ {2,}/)
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
}

/**
 * 冒頭の見出し（"第12回（令和８年２月）定例会"）から回次と元号を取る。
 * 見出しが見つからなければ null 埋めで返す。
 */
function parseSessionHeader(
  lines: readonly string[]
): Pick<
  ParsedGianResult,
  "sessionNumber" | "sessionLabel" | "era" | "year" | "month"
> {
  const empty = {
    sessionNumber: null,
    sessionLabel: null,
    era: null,
    year: null,
    month: null,
  };

  for (const line of lines.slice(0, 10)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const normalized = toHalfWidthDigits(trimmed);
    const matched = normalized.match(/第(\d{1,3})回/);
    if (!matched) continue;

    const era = KNOWN_ERAS.find((candidate) => trimmed.includes(candidate));
    // "（令和8年6月）" から元号年と月を取る
    const eraYear = era
      ? normalized.match(new RegExp(`${era}\\s*(\\d{1,2}|元)\\s*年`))
      : null;
    const month = normalized.match(/年\s*(\d{1,2})\s*月/);
    const eraYearNumber = eraYear
      ? eraYear[1] === "元"
        ? 1
        : Number(eraYear[1])
      : null;

    return {
      sessionNumber: Number(matched[1]),
      sessionLabel: trimmed,
      era: era ?? null,
      year:
        era && eraYearNumber !== null
          ? eraBaseYear(era) + eraYearNumber - 1
          : null,
      month: month ? Number(month[1]) : null,
    };
  }
  return empty;
}

/** "●条例 （地方自治法第96条第1項第1号）" を分類と根拠条項に分解する。 */
function parseSectionHeader(line: string): SectionContext | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("●")) return null;

  const body = trimmed.slice(1).trim();
  const name = body.replace(/[（(].*$/s, "").trim();
  const basis = body.match(/[（(]\s*(地方自治法[^）)]*)[）)]/);

  const found = SECTION_CATEGORIES.find(([label]) => name.startsWith(label));
  return {
    category: found ? found[1] : "other",
    legalBasis: basis ? basis[1].trim() : null,
  };
}

function matchVocabulary<T>(
  cell: string,
  vocabulary: ReadonlyArray<readonly [string, T]>
): T | null {
  const found = vocabulary.find(([label]) => cell === label);
  return found ? found[1] : null;
}

function isCommitteeResult(cell: string): boolean {
  return COMMITTEE_RESULT_PATTERN.test(cell) || cell === "-" || cell === "－";
}

function parseRecord(
  prevLine: string,
  numberLine: string,
  nextLine: string,
  era: string | null,
  section: SectionContext
): ParsedBill | null {
  const numberCells = splitCells(numberLine);
  const parsedNumber = parseBillNumber(numberCells[0] ?? "");
  if (!parsedNumber) return null;

  const prevCells = splitCells(prevLine);
  const nextCells = splitCells(nextLine);

  // --- 日付: 3行を読み順にたどり、1つ目を提出日、2つ目を議決（報告）日とする ---
  const dateCells = [...prevCells, ...numberCells, ...nextCells].filter(
    looksLikeWarekiDate
  );
  const submittedOn = normalizeWarekiDate(dateCells[0] ?? "", era);
  const decidedOn = normalizeWarekiDate(dateCells[1] ?? "", era);

  // --- 提出者・審査結果・審議結果: 語彙で特定する ---
  let submitter: BillSubmitter | null = null;
  let committeeResult: string | null = null;
  let decision: BillDecision | null = null;
  let submitterIndex = -1;

  nextCells.forEach((cell, index) => {
    const matchedSubmitter = matchVocabulary(cell, SUBMITTERS);
    if (matchedSubmitter && submitter === null) {
      submitter = matchedSubmitter;
      submitterIndex = index;
      return;
    }
    if (isCommitteeResult(cell) && committeeResult === null) {
      committeeResult = cell === "-" || cell === "－" ? null : cell;
      return;
    }
    const matchedDecision = matchVocabulary(cell, DECISIONS);
    if (matchedDecision && decision === null) {
      decision = matchedDecision;
    }
  });

  // --- 委員会: 前行の「最初の日付」と「最後の日付」に挟まれたセル ---
  const committee = extractCommittee(prevCells);

  // --- 議案名: メタ情報に当てはまらないセルを読み順に連結する ---
  const titleFromPrev = prevCells
    .slice(0, indexOfFirst(prevCells, looksLikeWarekiDate))
    .join("");
  const titleFromNumberLine = [
    stripBillNumberPrefix(numberCells[0]),
    ...numberCells.slice(1).filter((cell) => !looksLikeWarekiDate(cell)),
  ]
    .join("")
    .trim();
  const titleFromNext = nextCells
    .slice(0, submitterIndex === -1 ? 0 : submitterIndex)
    .join("");

  const title = `${titleFromPrev}${titleFromNumberLine}${titleFromNext}`.trim();
  if (!title) return null;

  return {
    billNumber: parsedNumber.billNumber,
    numberKind: parsedNumber.kind,
    numberValue: parsedNumber.value,
    title,
    category: section.category,
    legalBasis: section.legalBasis,
    submittedOn,
    submitter,
    committee,
    committeeResult,
    decidedOn,
    // 報告セクションには審議結果欄がない。日付が入っていれば報告済とみなす。
    decision:
      decision ??
      (section.category === "report" && decidedOn ? "reported" : null),
  };
}

function indexOfFirst(
  cells: readonly Cell[],
  predicate: (cell: Cell) => boolean
): number {
  const index = cells.findIndex(predicate);
  return index === -1 ? cells.length : index;
}

/**
 * 前行 `[議案名の断片?, 提出日, 委員会, 議決日]` から委員会セルを取り出す。
 * 日付が2つ揃っていない行（報告セクションなど）には委員会欄が存在しない。
 */
function extractCommittee(prevCells: readonly Cell[]): string | null {
  const first = prevCells.findIndex(looksLikeWarekiDate);
  const last = prevCells.reduce(
    (acc, cell, index) => (looksLikeWarekiDate(cell) ? index : acc),
    -1
  );
  if (first === -1 || last <= first + 1) return null;

  const between = prevCells
    .slice(first + 1, last)
    .join("")
    .trim();
  return between.length > 0 ? between : null;
}
