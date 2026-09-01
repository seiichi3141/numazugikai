import type { BillUpdateInput } from "../types";

/**
 * 議案のステータス変更時に、関連する公開中インタビューを自動クローズすべきかを判定する。
 *
 * 本会議で結論が出た議案は、以後の意見募集の意味が薄れるため対象にする。
 * 委員会審査中・提出済みなど、まだ結論が出ていないものは閉じない。
 */
const CONCLUDED_STATUSES = new Set<BillUpdateInput["status"]>([
  "passed",
  "rejected",
  "consented",
  "approved",
  "certified",
  "adopted",
  "not_adopted",
  "withdrawn",
]);

export function shouldAutoCloseInterviewOnBillStatus(
  status: BillUpdateInput["status"]
): boolean {
  return CONCLUDED_STATUSES.has(status);
}
