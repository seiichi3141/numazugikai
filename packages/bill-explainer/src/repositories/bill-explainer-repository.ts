import { createAdminClient } from "@mirai-gikai/supabase";
import type { DifficultyLevel } from "../shared/constants";

/** 解説の生成対象となる議案 */
export type ExplainTargetBill = {
  id: string;
  billNumber: string | null;
  name: string;
  category: string | null;
  submitter: string | null;
  committee: string | null;
  status: string;
  explanationSource: string;
  sessionName: string | null;
};

/**
 * 解説の生成対象を取得する。
 *
 * 会議録から当局説明を取り込めている議案だけが対象。説明が無い議案に
 * 解説を書かせると、モデルが一般知識で埋めてしまい誤情報になる。
 */
export async function findBillsToExplain(params: {
  /** 会期の slug で絞る。省略時は全会期 */
  sessionSlug?: string;
  /** 既に解説がある議案も対象にする */
  force?: boolean;
  limit?: number;
}): Promise<ExplainTargetBill[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("bills")
    .select(
      `id, bill_number, name, category, submitter, status, explanation_source,
       committees ( short_name ),
       council_sessions!inner ( name, slug ),
       bill_contents ( id )`
    )
    .not("explanation_source", "is", null)
    .order("bill_number_value", { ascending: true });

  if (params.sessionSlug) {
    query = query.eq("council_sessions.slug", params.sessionSlug);
  }
  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`解説対象の取得に失敗した: ${error.message}`);
  }

  return (data ?? [])
    .filter((row) => params.force || (row.bill_contents ?? []).length === 0)
    .map((row) => ({
      id: row.id,
      billNumber: row.bill_number,
      name: row.name,
      category: row.category,
      submitter: row.submitter,
      committee: row.committees?.short_name ?? null,
      status: row.status,
      explanationSource: row.explanation_source ?? "",
      sessionName: row.council_sessions?.name ?? null,
    }));
}

/**
 * 生成した解説を保存する。
 *
 * 同じ議案・同じ難易度の解説は1件に保つ。再生成のときは差し替える。
 */
export async function upsertBillContent(params: {
  billId: string;
  difficulty: DifficultyLevel;
  title: string;
  summary: string;
  content: string;
}): Promise<void> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("bill_contents")
    .select("id")
    .eq("bill_id", params.billId)
    .eq("difficulty_level", params.difficulty)
    .maybeSingle();

  const payload = {
    bill_id: params.billId,
    difficulty_level: params.difficulty,
    title: params.title,
    summary: params.summary,
    content: params.content,
  };

  const { error } = existing
    ? await supabase.from("bill_contents").update(payload).eq("id", existing.id)
    : await supabase.from("bill_contents").insert(payload);

  if (error) {
    throw new Error(`解説の保存に失敗した: ${error.message}`);
  }
}
