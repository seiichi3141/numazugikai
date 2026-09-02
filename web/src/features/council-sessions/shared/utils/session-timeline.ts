import type { CouncilSession } from "../types";

/** 今日から見た会期の位置づけ。一覧で「予定」「開会中」「閉会」を出し分ける。 */
export type SessionTiming = "upcoming" | "ongoing" | "closed";

/** 一覧に添えるラベル。閉会した会期がほとんどなので、閉会には何も付けない。 */
export const SESSION_TIMING_LABELS: Record<
  Exclude<SessionTiming, "closed">,
  string
> = {
  upcoming: "開会予定",
  ongoing: "開会中",
};

/**
 * 会期の位置づけを日付だけで決める純粋関数。
 *
 * 会期の召集・閉会は日付で告知されるので時刻は見ない。`today` は `YYYY-MM-DD`
 * の文字列で受け、DB の date 列とそのまま比較する。
 */
export function getSessionTiming(
  session: Pick<CouncilSession, "start_date" | "end_date">,
  today: string
): SessionTiming {
  if (today < session.start_date) return "upcoming";
  if (today > session.end_date) return "closed";
  return "ongoing";
}

/** 開始日の年で会期をまとめる。新しい年が先。中の並びは入力順を保つ。 */
export function groupSessionsByYear<
  T extends Pick<CouncilSession, "start_date">,
>(sessions: readonly T[]): { year: number; sessions: T[] }[] {
  const groups = new Map<number, T[]>();
  for (const session of sessions) {
    const year = Number(session.start_date.slice(0, 4));
    const group = groups.get(year);
    if (group) {
      group.push(session);
    } else {
      groups.set(year, [session]);
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, sessions]) => ({ year, sessions }));
}
