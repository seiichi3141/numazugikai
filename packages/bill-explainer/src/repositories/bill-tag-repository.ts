import { createAdminClient } from "@mirai-gikai/supabase";

const FETCH_PAGE_SIZE = 1000;

export type BillTagDefinition = {
  id: string;
  label: string;
  description: string | null;
};

export type BillTagTarget = {
  id: string;
  billNumber: string | null;
  name: string;
  category: string | null;
  title: string | null;
  summary: string | null;
  explanationSource: string | null;
};

export async function findAvailableBillTags(): Promise<BillTagDefinition[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, label, description")
    .not("featured_priority", "is", null)
    .order("featured_priority", { ascending: true });
  if (error) {
    throw new Error(`タグ候補の取得に失敗した: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error("分類に使えるタグが登録されていない");
  }
  return data;
}

/** 未分類、または force 指定時は全議案をページングして取得する。 */
export async function findBillsToAssignTags(params: {
  sessionSlug?: string;
  billIds?: string[];
  force?: boolean;
  limit?: number;
}): Promise<BillTagTarget[]> {
  const supabase = createAdminClient();
  const targets: BillTagTarget[] = [];
  const sessionId = params.sessionSlug
    ? await findCouncilSessionId(supabase, params.sessionSlug)
    : null;

  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    let query = supabase
      .from("bills")
      .select(
        `id, bill_number, name, category, explanation_source,
         bill_contents ( title, summary, difficulty_level ),
         bills_tags!left ( tag_id )`
      )
      .order("submitted_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + FETCH_PAGE_SIZE - 1);
    if (sessionId) query = query.eq("council_session_id", sessionId);
    if (params.billIds) query = query.in("id", params.billIds);
    if (!params.force) query = query.is("bills_tags", null);

    const { data, error } = await query;
    if (error) {
      throw new Error(`タグ付け対象の取得に失敗した: ${error.message}`);
    }

    for (const row of data ?? []) {
      if (!params.force && row.bills_tags.length > 0) continue;
      const content =
        row.bill_contents.find((item) => item.difficulty_level === "normal") ??
        row.bill_contents[0];
      targets.push({
        id: row.id,
        billNumber: row.bill_number,
        name: row.name,
        category: row.category,
        title: content?.title ?? null,
        summary: content?.summary ?? null,
        explanationSource: row.explanation_source,
      });
      if (params.limit !== undefined && targets.length >= params.limit) {
        return targets;
      }
    }
    if ((data ?? []).length < FETCH_PAGE_SIZE) break;
  }
  return targets;
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
  if (error) throw new Error(`会期の取得に失敗した: ${error.message}`);
  if (!data) throw new Error(`会期が見つからない: ${slug}`);
  return data.id;
}

export async function replaceBillTags(params: {
  billId: string;
  managedTagIds: string[];
  nextTagIds: string[];
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("replace_bill_tags", {
    p_bill_id: params.billId,
    p_managed_tag_ids: params.managedTagIds,
    p_next_tag_ids: params.nextTagIds,
  });
  if (error) throw new Error(`タグの置換に失敗した: ${error.message}`);
}
