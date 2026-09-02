import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../../packages/supabase/types/supabase.types";
import { adminClient, cleanupTestBill, createTestBill } from "../utils";

type SearchArgs =
  Database["public"]["Functions"]["search_bills_for_list"]["Args"];
type Row =
  Database["public"]["Functions"]["search_bills_for_list"]["Returns"][number];

async function search(
  params: Omit<SearchArgs, "p_difficulty"> = {}
): Promise<Row[]> {
  const { data, error } = await adminClient.rpc("search_bills_for_list", {
    p_difficulty: "normal",
    ...params,
  });
  if (error) throw new Error(`search_bills_for_list 失敗: ${error.message}`);
  return data ?? [];
}

/** 公開済みで解説付きの議案を作る。一覧に出る最小構成 */
async function createListedBill(overrides: {
  name: string;
  billNumber?: string;
  status?: Database["public"]["Enums"]["bill_status_enum"];
  submittedDate?: string;
  title?: string;
  summary?: string;
}) {
  const bill = await createTestBill({
    name: overrides.name,
    status: overrides.status ?? "passed",
    publish_status: "published",
    bill_number: overrides.billNumber ?? null,
    submitted_date: overrides.submittedDate ?? null,
  });

  const { error } = await adminClient.from("bill_contents").insert({
    bill_id: bill.id,
    difficulty_level: "normal",
    title: overrides.title ?? overrides.name,
    summary: overrides.summary ?? "テスト用の要約",
    content: "テスト用の本文",
  });
  if (error) throw new Error(`bill_contents 作成失敗: ${error.message}`);
  return bill;
}

describe("search_bills_for_list", () => {
  const billIds: string[] = [];
  // 他のテストや実データと混ざらないよう、検索語に一意な印を入れる
  const mark = `ZZ${Date.now()}`;

  beforeEach(async () => {
    const a = await createListedBill({
      name: `${mark}沼津市営墓地条例の一部改正`,
      billNumber: "議第63号",
      status: "passed",
    });
    const b = await createListedBill({
      name: `${mark}令和8年度一般会計予算`,
      billNumber: "議第39号",
      status: "in_committee",
    });
    const c = await createListedBill({
      name: `${mark}請願の処理`,
      billNumber: "請願第1号",
      status: "not_adopted",
    });
    billIds.push(a.id, b.id, c.id);
  });

  afterEach(async () => {
    for (const id of billIds.splice(0)) await cleanupTestBill(id);
  });

  it("解説がある公開議案だけを返す", async () => {
    const rows = await search({ p_query: mark, p_limit: 50 });
    expect(rows).toHaveLength(3);
    // 下書きや解説なしの議案は混ざらない
    expect(rows.every((r) => r.content_title !== null)).toBe(true);
  });

  it("絞り込み後の総件数を total_count で返す", async () => {
    const rows = await search({ p_query: mark, p_limit: 2 });
    expect(rows).toHaveLength(2);
    // 1ページ分しか返さなくても、総数は3件と分かる
    expect(rows[0].total_count).toBe(3);
  });

  it("limit と offset でページを切る", async () => {
    const page1 = await search({ p_query: mark, p_limit: 2, p_offset: 0 });
    const page2 = await search({ p_query: mark, p_limit: 2, p_offset: 2 });
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(1);
    // 同じ議案が2ページに現れない
    const ids = [...page1, ...page2].map((r) => r.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("議案名の部分一致で検索する", async () => {
    const rows = await search({ p_query: `${mark}沼津市営墓地` });
    expect(rows).toHaveLength(1);
    expect(rows[0].bill_number).toBe("議第63号");
  });

  it("全角と半角、大文字と小文字を区別しない", async () => {
    await createListedBill({ name: `${mark}AI活用の推進` }).then((b) =>
      billIds.push(b.id)
    );
    // TypeScript 側（search-bills.ts）と同じ正規化になっていること
    const zenkaku = await search({ p_query: `${mark}ＡＩ` });
    const lower = await search({ p_query: `${mark}ai` });
    expect(zenkaku).toHaveLength(1);
    expect(lower).toHaveLength(1);
  });

  it("空白を無視して検索する", async () => {
    const rows = await search({ p_query: `${mark} 沼津 市営 墓地 ` });
    expect(rows).toHaveLength(1);
  });

  it("空のクエリでは絞り込まない", async () => {
    const rows = await search({ p_query: "", p_limit: 200 });
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  describe("ステータスのグループ", () => {
    it("可決系をまとめる", async () => {
      const rows = await search({ p_query: mark, p_status_group: "enacted" });
      expect(rows.map((r) => r.bill_number)).toEqual(["議第63号"]);
    });

    it("否決・不採択をまとめる", async () => {
      const rows = await search({ p_query: mark, p_status_group: "rejected" });
      expect(rows.map((r) => r.bill_number)).toEqual(["請願第1号"]);
    });

    it("審議中をまとめる", async () => {
      const rows = await search({
        p_query: mark,
        p_status_group: "deliberating",
      });
      expect(rows.map((r) => r.bill_number)).toEqual(["議第39号"]);
    });

    it("all では絞り込まない", async () => {
      const rows = await search({ p_query: mark, p_status_group: "all" });
      expect(rows).toHaveLength(3);
    });
  });

  describe("並び替え", () => {
    it("提出日の新しい順・古い順で並ぶ", async () => {
      const dates = ["2026-03-01", "2026-01-01", "2026-02-01"];
      for (const date of dates) {
        const b = await createListedBill({
          name: `${mark}並び替え ${date}`,
          submittedDate: date,
        });
        billIds.push(b.id);
      }
      const newest = await search({
        p_query: `${mark}並び替え`,
        p_sort: "new",
      });
      const oldest = await search({
        p_query: `${mark}並び替え`,
        p_sort: "old",
      });
      expect(newest.map((r) => r.name.slice(-10))).toEqual([
        "2026-03-01",
        "2026-02-01",
        "2026-01-01",
      ]);
      expect(oldest.map((r) => r.id)).toEqual(
        [...newest].reverse().map((r) => r.id)
      );
    });

    it("提出日が無い議案は新しい順でも古い順でも最後にする", async () => {
      // TypeScript 側（sort-bills.ts）が両方向で末尾に沈めるのに合わせる。
      // DB の既定（desc は NULLS FIRST）のままだと日付なしが先頭に来てずれる。
      const dated = await createListedBill({
        name: `${mark}日付あり`,
        submittedDate: "2026-01-01",
      });
      const undated = await createListedBill({ name: `${mark}日付なし` });
      billIds.push(dated.id, undated.id);
      for (const sort of ["new", "old"]) {
        const rows = await search({ p_query: `${mark}日付`, p_sort: sort });
        expect(rows).toHaveLength(2);
        expect(rows.at(-1)?.id).toBe(undated.id);
      }
    });

    it("並び替えを変えても件数は変わらない", async () => {
      for (const sort of ["voices", "new", "old", "updated", "status"]) {
        const rows = await search({ p_query: mark, p_sort: sort });
        expect(rows).toHaveLength(3);
      }
    });

    it("提出日が同じでもページ間で議案が重複しない", async () => {
      // 並びが一意に決まらないと、同じ議案が1ページ目と2ページ目の
      // 両方に現れたり、どのページにも出なくなったりする。
      const sameDate = "2026-05-05";
      for (let i = 0; i < 5; i++) {
        const b = await createListedBill({
          name: `${mark}同日 ${i}`,
          submittedDate: sameDate,
        });
        billIds.push(b.id);
      }
      const query = `${mark}同日`;
      const collected: string[] = [];
      for (let offset = 0; offset < 5; offset += 2) {
        const page = await search({
          p_query: query,
          p_limit: 2,
          p_offset: offset,
        });
        collected.push(...page.map((r) => r.id));
      }
      expect(collected).toHaveLength(5);
      expect(new Set(collected).size).toBe(5);
    });
  });

  it("サムネイルの題材キーをそのまま返す", async () => {
    const bill = await createListedBill({
      name: `${mark}題材付きの議案`,
    });
    billIds.push(bill.id);
    await adminClient
      .from("bills")
      .update({ thumbnail_key: "budget" })
      .eq("id", bill.id);

    const rows = await search({ p_query: `${mark}題材付き` });
    expect(rows.map((r) => r.thumbnail_key)).toEqual(["budget"]);
  });

  it("タグが無い議案は空配列を返す（null にしない）", async () => {
    const rows = await search({ p_query: mark });
    expect(rows.every((r) => Array.isArray(r.tags))).toBe(true);
  });

  it("公開インタビューが無ければ interviewOnly で除外される", async () => {
    const rows = await search({ p_query: mark, p_interview_only: true });
    expect(rows).toHaveLength(0);
  });
});
