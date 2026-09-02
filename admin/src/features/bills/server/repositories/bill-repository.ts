import "server-only";
import type { Database } from "@mirai-gikai/supabase";
import { createAdminClient } from "@mirai-gikai/supabase";
import type {
  BillInsert,
  BillPublishStatus,
  BillSortConfig,
} from "../../shared/types";

type BillContentInsert =
  Database["public"]["Tables"]["bill_contents"]["Insert"];

/**
 * 議案の一覧を取得する。
 *
 * `range` を渡すとその範囲だけを引き、`total` に絞り込み前の総件数が入る。
 * 渡さない場合は全件を返すが、Supabase の返却上限（既定1000行）に当たると
 * 古い議案が黙って落ちるので、一覧の表示には範囲を指定すること。
 */
export async function findBillsWithCouncilSessions(
  sortConfig?: BillSortConfig,
  range?: { limit: number; offset: number }
) {
  const supabase = createAdminClient();
  const field = sortConfig?.field ?? "created_at";
  const ascending = (sortConfig?.order ?? "desc") === "asc";

  const orderOptions: { ascending: boolean; nullsFirst?: boolean } = {
    ascending,
  };

  if (field === "submitted_date") {
    orderOptions.nullsFirst = false;
  }

  const query = supabase
    .from("bills")
    // 総件数はページ数の表示にしか使わないので、範囲を切るときだけ数える。
    .select(
      "*, council_sessions(name), bill_debates(stance)",
      range ? { count: "exact" } : {}
    )
    .order(field, orderOptions)
    // 並びを一意に決める。提出日やステータスは同じ値が大量にあるので、
    // 決めておかないとページをまたいで同じ議案が二度出たり消えたりする。
    .order("id", { ascending: true });

  const { data, error, count } = await (range
    ? query.range(range.offset, range.offset + range.limit - 1)
    : query);

  if (error) {
    throw new Error(`Failed to fetch bills: ${error.message}`);
  }
  return { rows: data ?? [], total: count ?? 0 };
}

export async function findBillById(billId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("id", billId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch bill: ${error.message}`);
  }
  return data;
}

export async function createBill(insertData: BillInsert) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create bill: ${error.message}`);
  }
  return data;
}

export async function deleteBillById(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("bills").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete bill: ${error.message}`);
  }
}

export async function updateBillPublishStatus(
  billId: string,
  publishStatus: BillPublishStatus
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bills")
    .update({ publish_status: publishStatus })
    .eq("id", billId);

  if (error) {
    throw new Error(`Failed to update bill publish status: ${error.message}`);
  }
}

export async function findBillContentsByBillId(billId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bill_contents")
    .select("*")
    .eq("bill_id", billId);

  if (error) {
    throw new Error(`Failed to fetch bill contents: ${error.message}`);
  }
  return data;
}

export async function createBillContents(contents: BillContentInsert[]) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("bill_contents").insert(contents);

  if (error) {
    throw new Error(`Failed to create bill contents: ${error.message}`);
  }
}

export async function findPreviewToken(billId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("preview_tokens")
    .select("token, expires_at")
    .eq("bill_id", billId)
    .single();

  if (error || !data) {
    return null;
  }
  return data;
}

export async function createPreviewToken(params: {
  billId: string;
  token: string;
  expiresAt: string;
  createdBy: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("preview_tokens").insert({
    bill_id: params.billId,
    token: params.token,
    expires_at: params.expiresAt,
    created_by: params.createdBy,
  });

  if (error) {
    throw new Error(`Failed to insert preview token: ${error.message}`);
  }
}

export async function deletePreviewTokenByBillId(billId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("preview_tokens")
    .delete()
    .eq("bill_id", billId);

  if (error) {
    throw new Error(`Failed to delete preview token: ${error.message}`);
  }
}

export async function findPreviewTokenForValidation(
  billId: string,
  token: string
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("preview_tokens")
    .select("expires_at")
    .eq("bill_id", billId)
    .eq("token", token)
    .single();

  if (error || !data) {
    return null;
  }
  return data;
}
