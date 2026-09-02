import type { BillThumbnailSubjectKey } from "@mirai-gikai/shared/bill-thumbnail/subjects";
import { createAdminClient } from "@mirai-gikai/supabase";

/** 1 回の取得で読む行数。PostgREST の既定上限に合わせる。 */
const FETCH_PAGE_SIZE = 1000;

/** 題材の割り当て対象となる議案 */
export type ThumbnailTargetBill = {
  id: string;
  billNumber: string | null;
  name: string;
  category: string | null;
  /** やさしい版の解説。無ければ null */
  title: string | null;
  summary: string | null;
};

/**
 * 題材が未設定の議案を取得する。
 *
 * 解説と違って材料が無くても決められる（正式名称と分類で足りる）ため、
 * 公開状態や解説の有無では絞らない。
 */
export async function findBillsWithoutThumbnailKey(params: {
  /** 会期の slug で絞る。省略時は全会期 */
  sessionSlug?: string;
  /** 議案 ID で絞る。省略時は全議案 */
  billIds?: string[];
  /** 既に題材がある議案も対象にする */
  force?: boolean;
  limit?: number;
}): Promise<ThumbnailTargetBill[]> {
  const supabase = createAdminClient();
  const bills: ThumbnailTargetBill[] = [];
  // 会期は ID で絞る。埋め込みの内部結合で絞ると、会期未設定の議案まで漏れる。
  const sessionId = params.sessionSlug
    ? await findCouncilSessionId(supabase, params.sessionSlug)
    : null;

  // PostgREST は 1 回の応答を 1000 行で切るため、上限なしの全件処理では
  // ページを追って取り切る。
  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const remaining =
      params.limit === undefined
        ? FETCH_PAGE_SIZE
        : params.limit - bills.length;
    const pageSize = Math.min(FETCH_PAGE_SIZE, remaining);
    if (pageSize <= 0) break;

    let query = supabase
      .from("bills")
      .select(
        `id, bill_number, name, category, thumbnail_key,
         bill_contents ( title, summary, difficulty_level )`
      )
      .order("bill_number_value", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (!params.force) {
      query = query.is("thumbnail_key", null);
    }
    if (sessionId) {
      query = query.eq("council_session_id", sessionId);
    }
    if (params.billIds) {
      query = query.in("id", params.billIds);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`題材の割り当て対象の取得に失敗した: ${error.message}`);
    }

    for (const row of data ?? []) {
      const content =
        row.bill_contents.find((c) => c.difficulty_level === "normal") ??
        row.bill_contents[0];
      bills.push({
        id: row.id,
        billNumber: row.bill_number,
        name: row.name,
        category: row.category,
        title: content?.title ?? null,
        summary: content?.summary ?? null,
      });
    }
    if ((data ?? []).length < pageSize) break;
  }

  return bills;
}

async function findCouncilSessionId(
  supabase: ReturnType<typeof createAdminClient>,
  slug: string
): Promise<string> {
  const { data, error } = await supabase
    .from("council_sessions")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    throw new Error(`会期の取得に失敗した: ${error.message}`);
  }
  if (!data) {
    throw new Error(`会期が見つからない: ${slug}`);
  }
  return data.id;
}

export async function updateBillThumbnailKey(params: {
  billId: string;
  key: BillThumbnailSubjectKey;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bills")
    .update({ thumbnail_key: params.key })
    .eq("id", params.billId);
  if (error) {
    throw new Error(`題材の保存に失敗した: ${error.message}`);
  }
}
