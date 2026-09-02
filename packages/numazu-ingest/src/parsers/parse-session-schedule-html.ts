import { KNOWN_ERAS, toHalfWidthDigits } from "./normalize-wareki";

/** 定例会会期予定ページから読み取った1会期分 */
export type ParsedSessionSchedule = {
  /** 表記そのまま（例: "令和8年第13回（6月）定例会"） */
  label: string;
  /** 回次（例: 13） */
  sessionNumber: number;
  /** 開会予定日（ISO 8601） */
  startDate: string;
  /** 閉会予定日（ISO 8601） */
  endDate: string;
};

const ERA_BASE_YEAR: Record<string, number> = {
  令和: 2019,
  平成: 1989,
  昭和: 1926,
};

/** HTMLタグを落として実体参照を戻し、空白を1つに畳む。 */
function toText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** "令和8年第13回（6月）定例会" から西暦年と回次を取る。 */
function parseSessionLabel(
  label: string
): { year: number; sessionNumber: number } | null {
  const normalized = toHalfWidthDigits(label);
  const era = KNOWN_ERAS.find((candidate) => normalized.includes(candidate));
  if (!era) return null;

  const eraYear = normalized.match(new RegExp(`${era}\\s*(\\d{1,2}|元)\\s*年`));
  const session = normalized.match(/第\s*(\d{1,3})\s*回/);
  if (!eraYear || !session) return null;

  const yearNumber = eraYear[1] === "元" ? 1 : Number(eraYear[1]);
  return {
    year: ERA_BASE_YEAR[era] + yearNumber - 1,
    sessionNumber: Number(session[1]),
  };
}

/** "6月5日（金曜日）" から月日を取る。 */
function parseMonthDay(text: string): { month: number; day: number } | null {
  const matched = toHalfWidthDigits(text).match(
    /(\d{1,2})\s*月\s*(\d{1,2})\s*日/
  );
  if (!matched) return null;
  const month = Number(matched[1]);
  const day = Number(matched[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * 沼津市議会「定例会会期予定」ページのHTMLから、各定例会の会期を取り出す。
 *
 * 表は `定例会 | 開会予定日 | 閉会予定日` の3列で、年は定例会名の元号表記にしか
 * 現れないため、開会・閉会の日付には定例会名から得た年を当てる。
 * 閉会月が開会月より小さい場合（12月開会〜1月閉会など）は翌年とみなす。
 */
export function parseSessionScheduleHtml(
  html: string
): ParsedSessionSchedule[] {
  const schedules: ParsedSessionSchedule[] = [];

  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => toText(cell[1]))
      .filter((cell) => cell.length > 0);
    if (cells.length < 3) continue;

    const [labelCell, startCell, endCell] = cells;
    if (!labelCell.includes("定例会") && !labelCell.includes("臨時会"))
      continue;

    const parsedLabel = parseSessionLabel(labelCell);
    const start = parseMonthDay(startCell);
    const end = parseMonthDay(endCell);
    if (!parsedLabel || !start || !end) continue;

    const endYear =
      end.month < start.month ? parsedLabel.year + 1 : parsedLabel.year;

    schedules.push({
      label: labelCell,
      sessionNumber: parsedLabel.sessionNumber,
      startDate: toIsoDate(parsedLabel.year, start.month, start.day),
      endDate: toIsoDate(endYear, end.month, end.day),
    });
  }

  return schedules;
}
