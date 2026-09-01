import type { Database } from "@mirai-gikai/supabase";

// Database types
export type Bill = Database["public"]["Tables"]["bills"]["Row"];
export type BillInsert = Database["public"]["Tables"]["bills"]["Insert"];
export type BillUpdate = Database["public"]["Tables"]["bills"]["Update"];

export type BillContent = Database["public"]["Tables"]["bill_contents"]["Row"];
export type BillContentInsert =
  Database["public"]["Tables"]["bill_contents"]["Insert"];
export type BillContentUpdate =
  Database["public"]["Tables"]["bill_contents"]["Update"];

export type MiraiStance = Database["public"]["Tables"]["mirai_stances"]["Row"];

// Enums
export type BillStatusEnum = Database["public"]["Enums"]["bill_status_enum"];
export type BillCategoryEnum =
  Database["public"]["Enums"]["bill_category_enum"];
export type BillSubmitterEnum =
  Database["public"]["Enums"]["bill_submitter_enum"];
export type StanceTypeEnum = Database["public"]["Enums"]["stance_type_enum"];

// 公開ステータス型（議案の公開/非公開を管理）
export type BillPublishStatus = "draft" | "published" | "coming_soon";

// Coming Soon議案の型（最小限の情報のみ）
export type ComingSoonBill = {
  id: string;
  name: string; // 正式名称
  title: string | null; // わかりやすいタイトル（bill_contentsから）
  bill_number: string | null;
  source_url: string | null;
};

// Combined types for UI
export type BillWithStance = Bill & {
  mirai_stance?: MiraiStance;
};

export type BillTag = {
  id: string;
  label: string;
};

export type FeaturedTag = {
  id: string;
  label: string;
  priority: number;
};

/**
 * 一覧のカードが読む項目だけの形。
 *
 * 一覧は DB 側で絞り込んでページごとに取るようになったので、`bills` の
 * 全列は返ってこない。`BillWithContent` を要求すると使いもしない列を
 * RPC に足すことになるため、実際に読む項目だけを求める。
 * `BillWithContent` はこの形を満たすので、既存の呼び出しはそのまま通る。
 */
export type BillListItem = Pick<
  Bill,
  | "id"
  | "name"
  | "bill_number"
  | "status"
  | "submitted_date"
  | "thumbnail_url"
  | "is_review_completed"
> & {
  bill_content?: { title: string | null; summary: string | null };
  tags: BillTag[];
  hasPublicInterview?: boolean;
  publicReportCount?: number;
};

export type BillWithContent = Bill & {
  bill_content?: BillContent;
  mirai_stance?: MiraiStance;
  tags: BillTag[];
  featured_tag?: FeaturedTag;
  hasPublicInterview?: boolean;
  /** 公開レポート件数。一覧の回答数バッジと「声が集まっている順」に使う。 */
  publicReportCount?: number;
};

// タグごとにグループ化された議案
export type BillsByTag = {
  tag: BillTag & { description?: string; priority: number };
  bills: BillWithContent[];
};

// ステータスのソート順（DBのstatus_order generated columnと一致させる）
export const BILL_STATUS_ORDER: Record<BillStatusEnum, number> = {
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
export const BILL_STATUS_LABELS: Record<BillStatusEnum, string> = {
  preparing: "準備中",
  submitted: "提出",
  in_committee: "委員会で審査中",
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

// 議案分類の日本語ラベル（地方自治法第96条の区分に対応）
export const BILL_CATEGORY_LABELS: Record<BillCategoryEnum, string> = {
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
export const BILL_SUBMITTER_LABELS: Record<BillSubmitterEnum, string> = {
  mayor: "市長",
  member: "議員",
  committee: "委員会",
  citizen: "市民",
};

/** ステータスを日本語ラベルに変換する */
export function getBillStatusLabel(status: BillStatusEnum): string {
  return BILL_STATUS_LABELS[status] ?? status;
}

/**
 * 議決が確定したステータスかどうか。
 * 確定済みの議案は結果を、そうでない議案は審議の進み具合を見せる。
 */
export function isConcludedStatus(status: BillStatusEnum): boolean {
  return (
    status !== "preparing" &&
    status !== "submitted" &&
    status !== "in_committee"
  );
}

export const STANCE_LABELS: Record<StanceTypeEnum, string> = {
  for: "賛成",
  against: "反対",
  neutral: "中立",
  conditional_for: "条件付き賛成",
  conditional_against: "条件付き反対",
  considering: "検討中",
  continued_deliberation: "継続審査中",
  free_vote: "自由投票",
};
