import "server-only";

import { createAdminClient } from "@mirai-gikai/supabase";

/**
 * 議案の公開レポート件数を数える（公開 = is_public_by_admin × is_public_by_user）。
 * オープンデータAPIの配布下限判定などに使う共通関数。
 *
 * 公開の定義（管理者公開×ユーザー同意）を1箇所に持つため、各所がこれを共有する。
 * 一覧のバッジは議案ごとに呼ぶと件数ぶんのクエリになるので、DB関数
 * count_public_reports_by_bill_ids を search_bills_for_list から呼んで数える。
 * 定義を変えるときは、そちらのSQLと揃っているか確かめること。
 */
export async function countPublicReportsByBillId(
  billId: string
): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("interview_report")
    .select("id, interview_sessions!inner(interview_configs!inner(bill_id))", {
      count: "exact",
      head: true,
    })
    .eq("is_public_by_admin", true)
    .eq("is_public_by_user", true)
    .eq("interview_sessions.interview_configs.bill_id", billId);

  if (error) {
    throw new Error(`Failed to count public interview reports: ${error.message}`);
  }

  return count ?? 0;
}
