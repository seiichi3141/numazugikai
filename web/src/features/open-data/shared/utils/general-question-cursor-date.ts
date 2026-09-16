/**
 * 開催日の降順、質問順の昇順を既存の時刻カーソル1列へ写像する。
 * 値は不透明なページネーションキーとしてだけ利用する。
 */
export function generalQuestionCursorDate(
  heldOn: string | null,
  fallbackDate: string,
  questionOrder: number | null
): string {
  const date = heldOn ?? fallbackDate;
  if (questionOrder === null) return `${date}T00:00:00.000000Z`;
  const rank = 999_999 - Math.min(Math.max(questionOrder, 1), 999_998);
  return `${date}T23:59:59.${String(rank).padStart(6, "0")}Z`;
}
