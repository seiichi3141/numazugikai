const CURRENT_TERM = 25;
const CURRENT_TERM_START_YEAR = 2023;

/**
 * 回数表記のない旧一般質問資料を、4年任期内の定例会順へ対応させる。
 * 任期開始年の6月を第1回とし、6月・9月・11月・翌2月の順で数える。
 */
export function inferGeneralQuestionSessionNumber(
  term: number,
  year: number,
  month: number
): number | null {
  const termStartYear = CURRENT_TERM_START_YEAR - (CURRENT_TERM - term) * 4;
  const offset = year - termStartYear;
  if (offset < 0 || offset > 4) return null;
  if (month === 6) return offset * 4 + 1;
  if (month === 9) return offset * 4 + 2;
  if (month === 11) return offset * 4 + 3;
  if (month === 2 && offset >= 1) return (offset - 1) * 4 + 4;
  return null;
}

export function getMonthDateRange(
  year: number,
  month: number
): { startDate: string; endDate: string } {
  const paddedMonth = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${year}-${paddedMonth}-01`,
    endDate: `${year}-${paddedMonth}-${String(lastDay).padStart(2, "0")}`,
  };
}
