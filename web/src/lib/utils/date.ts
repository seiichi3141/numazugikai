const jstLongDateFormat = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Tokyo",
});

const jstNumericDateFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
});

const jstDateTimeFormat = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Tokyo",
});

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return jstLongDateFormat.format(date);
}

/**
 * 日付をドット区切り形式でフォーマット (例: 2025.10.1)
 * ゼロ埋めなし
 */
export function formatDateWithDots(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return jstNumericDateFormat.format(date).replaceAll("/", ".");
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return jstDateTimeFormat.format(date);
}

/**
 * 日本時間の現在時刻を返す
 */
export function getJapanTime(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  );
}

/**
 * Date を DB の date 列と比べられる `YYYY-MM-DD` にする（ローカル時刻の年月日）。
 * 会期の開会・閉会は日付で決まるので、時刻や UTC 変換で日がずれないようにする。
 */
export function toDateOnlyString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
