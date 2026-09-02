/** 元号ごとの元年の西暦。令和元年 = 1989 + ... ではなく実年で持つ。 */
const ERA_BASE_YEAR: Record<string, number> = {
  令和: 2019,
  平成: 1989,
  昭和: 1926,
};

/** 元号名として認識する文字列 */
export const KNOWN_ERAS = Object.keys(ERA_BASE_YEAR);

/** 全角数字を半角に直す。 */
export function toHalfWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/**
 * 議案審議結果PDFの日付表記（"8.6.29" = 令和8年6月29日）を ISO 8601 に変換する。
 *
 * PDFは元号を省いて「年.月.日」とだけ書くため、元号は呼び出し側が渡す。
 * 元号が不明・未知、または日付として成立しない場合は null を返す。
 */
export function normalizeWarekiDate(
  value: string,
  era: string | null
): string | null {
  if (!era) return null;
  const baseYear = ERA_BASE_YEAR[era];
  if (baseYear === undefined) return null;

  const matched = toHalfWidthDigits(value.trim()).match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{1,2})$/
  );
  if (!matched) return null;

  const [, eraYearText, monthText, dayText] = matched;
  const eraYear = Number(eraYearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (eraYear < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const year = baseYear + eraYear - 1;
  const date = new Date(Date.UTC(year, month - 1, day));
  // 2月30日のような存在しない日付を弾く
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** "8.6.29" 形式の日付らしき文字列かどうか。 */
export function looksLikeWarekiDate(value: string): boolean {
  return /^\s*[0-9０-９]{1,2}\.[0-9０-９]{1,2}\.[0-9０-９]{1,2}\s*$/.test(
    value
  );
}
