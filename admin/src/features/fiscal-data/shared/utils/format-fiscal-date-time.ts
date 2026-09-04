export function formatFiscalDateTime(value: string | null): string {
  if (!value) return "不明";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
