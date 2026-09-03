import type { BillDecision } from "../shared/types";

/** DBの bill_status_enum。@mirai-gikai/supabase の型に合わせる。 */
export type BillStatus =
  | "preparing"
  | "submitted"
  | "in_committee"
  | "passed"
  | "rejected"
  | "consented"
  | "approved"
  | "certified"
  | "adopted"
  | "not_adopted"
  | "continued"
  | "withdrawn"
  | "reported";

/**
 * 議決結果から議案ステータスを決める。
 *
 * 議決がまだ出ていない議案は、委員会に付託されていれば `in_committee`、
 * そうでなければ `submitted` とする。
 */
export function toBillStatus(
  decision: BillDecision | null,
  committee: string | null
): BillStatus {
  if (decision) return decision;
  // 「省略」は付託を省略した意味なので、委員会審査中ではない
  if (committee && committee !== "省略") return "in_committee";
  return "submitted";
}

/** 市民向けの短いステータス説明。議案詳細の補足に使う。 */
export function toStatusNote(
  decision: BillDecision | null,
  committee: string | null,
  committeeResult: string | null
): string | null {
  if (!decision) {
    if (committee && committee !== "省略") {
      return `${committee}委員会で審査中`;
    }
    return null;
  }

  const label = DECISION_LABELS[decision];
  if (committee && committee !== "省略" && committeeResult) {
    return `${committee}委員会が「${committeeResult}」と決定し、本会議で${label}`;
  }
  return `本会議で${label}`;
}

const DECISION_LABELS: Record<BillDecision, string> = {
  passed: "可決",
  rejected: "否決",
  consented: "同意",
  approved: "承認",
  certified: "認定",
  adopted: "採択",
  not_adopted: "不採択",
  continued: "継続審査",
  withdrawn: "撤回",
  reported: "報告",
};

/** 会期の slug。西暦年と回次から作る（例: 2026年 第13回 → "2026-13"）。 */
export function buildSessionSlug(year: number, sessionNumber: number): string {
  return `${year}-${sessionNumber}`;
}

const ERA_BASE_YEAR: Record<string, number> = {
  令和: 2019,
  平成: 1989,
  昭和: 1926,
};

/**
 * 会期名を源泉によらず同じ表記にそろえる。
 *
 * 会期予定ページは「令和8年第13回（6月）定例会」、議案審議結果PDFの見出しは
 * 「第13回（令和８年６月）定例会」と表記が違うため、前者に合わせる。
 */
export function buildSessionName(params: {
  year: number;
  sessionNumber: number;
  month: number | null;
  kind: "regular" | "extraordinary";
  era?: string;
}): string {
  const era =
    params.era ??
    (params.year > ERA_BASE_YEAR.令和 ||
    (params.year === ERA_BASE_YEAR.令和 && (params.month ?? 12) >= 5)
      ? "令和"
      : params.year >= ERA_BASE_YEAR.平成
        ? "平成"
        : "昭和");
  const baseYear = ERA_BASE_YEAR[era];
  const kindLabel = params.kind === "extraordinary" ? "臨時会" : "定例会";
  const eraYear =
    baseYear === undefined ? params.year : params.year - baseYear + 1;
  const monthPart = params.month === null ? "" : `（${params.month}月）`;
  return `${era}${eraYear}年第${params.sessionNumber}回${monthPart}${kindLabel}`;
}
