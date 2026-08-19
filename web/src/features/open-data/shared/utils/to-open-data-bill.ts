import {
  BILL_CATEGORY_LABELS,
  BILL_SUBMITTER_LABELS,
  type BillCategoryEnum,
  type BillStatusEnum,
  type BillSubmitterEnum,
  getBillStatusLabel,
  STANCE_LABELS,
  type StanceTypeEnum,
} from "@/features/bills/shared/types";
import type {
  OpenDataBillDetail,
  OpenDataBillItem,
  OpenDataMiraiStance,
} from "../types/open-data-bills";

export type OpenDataBillRow = {
  id: string;
  name: string;
  status: BillStatusEnum;
  status_note: string | null;
  bill_number: string | null;
  category: BillCategoryEnum | null;
  submitter: BillSubmitterEnum | null;
  committees: { short_name: string } | null;
  submitted_date: string | null;
  decided_on: string | null;
  document_url: string | null;
  published_at: string | null;
  created_at: string;
  /** 難易度で絞り込み済みのため実質1件 */
  bill_contents: { title: string; summary: string }[];
  mirai_stances: { type: StanceTypeEnum; comment: string | null } | null;
  bills_tags: { tags: { id: string; label: string } | null }[];
};

/**
 * DBの議案行をオープンデータAPIのレスポンス項目に変換する。
 */
export function toOpenDataBillItem(row: OpenDataBillRow): OpenDataBillItem {
  const billContent = row.bill_contents[0];
  return {
    billId: row.id,
    name: row.name,
    title: billContent?.title ?? "",
    summary: billContent?.summary ?? "",
    status: row.status,
    statusLabel: getBillStatusLabel(row.status),
    statusNote: row.status_note,
    billNumber: row.bill_number,
    category: row.category,
    categoryLabel: row.category ? BILL_CATEGORY_LABELS[row.category] : null,
    submitter: row.submitter,
    submitterLabel: row.submitter ? BILL_SUBMITTER_LABELS[row.submitter] : null,
    committee: row.committees?.short_name ?? null,
    submittedDate: row.submitted_date,
    decidedOn: row.decided_on,
    documentUrl: row.document_url,
    publishedAt: row.published_at,
    tags: row.bills_tags.flatMap((billTag) =>
      billTag.tags ? [{ id: billTag.tags.id, label: billTag.tags.label }] : []
    ),
    miraiStance: toOpenDataMiraiStance(row.mirai_stances),
    createdAt: row.created_at,
  };
}

export type OpenDataBillDetailRow = Omit<OpenDataBillRow, "bill_contents"> & {
  bill_contents: { title: string; summary: string; content: string }[];
};

/**
 * DBの議案行（本文付き）をオープンデータAPIの詳細レスポンスに変換する。
 */
export function toOpenDataBillDetail(
  row: OpenDataBillDetailRow
): OpenDataBillDetail {
  return {
    ...toOpenDataBillItem(row),
    content: row.bill_contents[0]?.content ?? "",
  };
}

/**
 * チームみらいの賛否行をレスポンス形式（日本語ラベル付き）に変換する。
 */
export function toOpenDataMiraiStance(
  stance: { type: StanceTypeEnum; comment: string | null } | null
): OpenDataMiraiStance | null {
  if (!stance) return null;
  return {
    type: stance.type,
    label: STANCE_LABELS[stance.type],
    comment: stance.comment,
  };
}
