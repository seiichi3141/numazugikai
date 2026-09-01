import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../../packages/supabase/types/supabase.types";
import { adminClient, cleanupTestBill, createTestBill } from "../utils";

type FacetArgs =
  Database["public"]["Functions"]["count_bills_for_list_facets"]["Args"];
type Facet =
  Database["public"]["Functions"]["count_bills_for_list_facets"]["Returns"][number];

async function facets(
  params: Omit<FacetArgs, "p_difficulty"> = {}
): Promise<Facet[]> {
  const { data, error } = await adminClient.rpc("count_bills_for_list_facets", {
    p_difficulty: "normal",
    ...params,
  });
  if (error)
    throw new Error(`count_bills_for_list_facets 失敗: ${error.message}`);
  return data ?? [];
}

/** 0件のグループは行に出てこないので、画面と同じく0を埋めて読む */
function countOf(rows: Facet[], kind: string, key: string): number {
  return rows.find((r) => r.kind === kind && r.key === key)?.count ?? 0;
}

async function createTag(label: string) {
  const { data, error } = await adminClient
    .from("tags")
    .insert({ label })
    .select()
    .single();
  if (error) throw new Error(`tag 作成失敗: ${error.message}`);
  return data;
}

describe("count_bills_for_list_facets", () => {
  const billIds: string[] = [];
  const tagIds: string[] = [];
  const mark = `ZZ${Date.now()}`;
  let kurashi: { id: string };
  let kosodate: { id: string };

  async function createListedBill(overrides: {
    name: string;
    status?: Database["public"]["Enums"]["bill_status_enum"];
    tagId?: string;
  }) {
    const bill = await createTestBill({
      name: overrides.name,
      status: overrides.status ?? "passed",
      publish_status: "published",
    });
    const { error } = await adminClient.from("bill_contents").insert({
      bill_id: bill.id,
      difficulty_level: "normal",
      title: overrides.name,
      summary: "テスト用の要約",
      content: "テスト用の本文",
    });
    if (error) throw new Error(`bill_contents 作成失敗: ${error.message}`);
    if (overrides.tagId) {
      const { error: tagError } = await adminClient
        .from("bills_tags")
        .insert({ bill_id: bill.id, tag_id: overrides.tagId });
      if (tagError) throw new Error(`bills_tags 作成失敗: ${tagError.message}`);
    }
    billIds.push(bill.id);
    return bill;
  }

  beforeEach(async () => {
    kurashi = await createTag(`${mark}暮らし`);
    kosodate = await createTag(`${mark}子育て`);
    tagIds.push(kurashi.id, kosodate.id);

    // 暮らし: 可決2件・審議中1件 / 子育て: 可決1件
    await createListedBill({ name: `${mark}議案A`, tagId: kurashi.id });
    await createListedBill({ name: `${mark}議案B`, tagId: kurashi.id });
    await createListedBill({
      name: `${mark}議案C`,
      status: "in_committee",
      tagId: kurashi.id,
    });
    await createListedBill({ name: `${mark}議案D`, tagId: kosodate.id });
  });

  afterEach(async () => {
    for (const id of billIds.splice(0)) await cleanupTestBill(id);
    for (const id of tagIds.splice(0)) {
      await adminClient.from("tags").delete().eq("id", id);
    }
  });

  it("ステータスのグループごとに数える", async () => {
    const rows = await facets({ p_query: mark });
    expect(countOf(rows, "status", "all")).toBe(4);
    expect(countOf(rows, "status", "enacted")).toBe(3);
    expect(countOf(rows, "status", "deliberating")).toBe(1);
  });

  it("0件のグループは行に現れない", async () => {
    const rows = await facets({ p_query: mark });
    expect(rows.some((r) => r.kind === "status" && r.key === "rejected")).toBe(
      false
    );
  });

  it("タグごとに数える", async () => {
    const rows = await facets({ p_query: mark });
    expect(countOf(rows, "tag", kurashi.id)).toBe(3);
    expect(countOf(rows, "tag", kosodate.id)).toBe(1);
    expect(countOf(rows, "tag", "all")).toBe(4);
  });

  it("ステータスの件数はタグ絞り込みを反映する", async () => {
    const rows = await facets({ p_query: mark, p_tag_id: kosodate.id });
    // 子育ては可決1件だけ。暮らしの3件は数に入らない
    expect(countOf(rows, "status", "all")).toBe(1);
    expect(countOf(rows, "status", "enacted")).toBe(1);
    expect(countOf(rows, "status", "deliberating")).toBe(0);
  });

  it("ステータスの件数は自分自身の絞り込みを無視する", async () => {
    // 「可決」を選んでいても、他のタブの件数が0にならないこと
    const rows = await facets({ p_query: mark, p_status_group: "enacted" });
    expect(countOf(rows, "status", "deliberating")).toBe(1);
    expect(countOf(rows, "status", "all")).toBe(4);
  });

  it("タグの件数はステータス絞り込みを反映する", async () => {
    const rows = await facets({
      p_query: mark,
      p_status_group: "deliberating",
    });
    // 審議中は暮らしの1件だけ
    expect(countOf(rows, "tag", kurashi.id)).toBe(1);
    expect(countOf(rows, "tag", "all")).toBe(1);
    expect(countOf(rows, "tag", kosodate.id)).toBe(0);
  });

  it("タグの件数は自分自身の絞り込みを無視する", async () => {
    // タグを選んだ瞬間に他のタグが全部0件になると、選び直せなくなる
    const rows = await facets({ p_query: mark, p_tag_id: kurashi.id });
    expect(countOf(rows, "tag", kosodate.id)).toBe(1);
    expect(countOf(rows, "tag", kurashi.id)).toBe(3);
  });

  it("検索語で絞り込む", async () => {
    const rows = await facets({ p_query: `${mark}議案C` });
    expect(countOf(rows, "status", "all")).toBe(1);
    expect(countOf(rows, "status", "deliberating")).toBe(1);
  });

  it("インタビュー受付中のみでは0件になる", async () => {
    const rows = await facets({ p_query: mark, p_interview_only: true });
    expect(countOf(rows, "status", "all")).toBe(0);
    expect(countOf(rows, "tag", "all")).toBe(0);
  });
});
