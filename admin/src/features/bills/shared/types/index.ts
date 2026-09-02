import type { Database } from "@mirai-gikai/supabase";

export type Bill = Database["public"]["Tables"]["bills"]["Row"];
export type BillInsert = Database["public"]["Tables"]["bills"]["Insert"];
export type BillUpdate = Database["public"]["Tables"]["bills"]["Update"];

export type BillStatus = Database["public"]["Enums"]["bill_status_enum"];
export type BillPublishStatus =
  Database["public"]["Enums"]["bill_publish_status"];
export type BillCategory = Database["public"]["Enums"]["bill_category_enum"];
export type BillNumberKind =
  Database["public"]["Enums"]["bill_number_kind_enum"];
export type BillSubmitter = Database["public"]["Enums"]["bill_submitter_enum"];

export type BillWithContent = Bill & {
  bill_content?: Database["public"]["Tables"]["bill_contents"]["Row"];
};

export type BillWithCouncilSession = Bill & {
  council_sessions: { name: string } | null;
  /** 本会議での討論。賛成・反対の立場表明があったかを見るために持つ */
  bill_debates: { stance: "for" | "against" }[];
};

/**
 * 議案の討論状況を数える。
 *
 * 市長提出議案はほとんどが可決されるため、議決結果だけでは
 * 議論のあった議案が分からない。討論の有無がその手がかりになる。
 */
export function countDebateStances(
  debates: ReadonlyArray<{ stance: "for" | "against" }>
): { for: number; against: number; total: number } {
  const against = debates.filter((d) => d.stance === "against").length;
  return { for: debates.length - against, against, total: debates.length };
}

import type { SortConfig } from "@/lib/sort";

// ソート関連の型定義
export type BillSortField =
  | "created_at"
  | "submitted_date"
  | "status_order"
  | "publish_status_order";

export const BILL_SORT_FIELDS: readonly BillSortField[] = [
  "created_at",
  "submitted_date",
  "status_order",
  "publish_status_order",
] as const;

export type BillSortConfig = SortConfig<BillSortField>;

export const DEFAULT_BILL_SORT: BillSortConfig = {
  field: "created_at",
  order: "desc",
};

// ステータスのソート順（DBのstatus_order generated columnと一致させる）
export const BILL_STATUS_ORDER: Record<BillStatus, number> = {
  passed: 0,
  consented: 1,
  approved: 2,
  certified: 3,
  adopted: 4,
  rejected: 5,
  not_adopted: 6,
  withdrawn: 7,
  continued: 8,
  reported: 9,
  in_committee: 10,
  submitted: 11,
  preparing: 12,
};

// 議案ステータスの日本語ラベル
export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  preparing: "準備中",
  submitted: "提出",
  in_committee: "委員会審査中",
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

// 議案分類の日本語ラベル（地方自治法の区分に対応）
export const BILL_CATEGORY_LABELS: Record<BillCategory, string> = {
  ordinance: "条例",
  budget: "予算",
  settlement: "決算",
  contract: "契約・財産",
  provisional_approval: "専決承認",
  report: "報告",
  personnel: "人事",
  opinion_paper: "意見書・決議",
  petition: "請願・陳情",
  other: "その他",
};

// 提出者の日本語ラベル
export const BILL_SUBMITTER_LABELS: Record<BillSubmitter, string> = {
  mayor: "市長",
  member: "議員",
  committee: "委員会",
  citizen: "市民",
};

/** ステータスを日本語ラベルに変換する */
export function getBillStatusLabel(status: BillStatus): string {
  return BILL_STATUS_LABELS[status] ?? status;
}
