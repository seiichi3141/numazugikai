import { afterEach, describe, expect, it } from "vitest";
import {
  adminClient,
  cleanupTestBill,
  cleanupTestTag,
  createTestBill,
  createTestBillTag,
  createTestTag,
} from "../utils";

describe("replace_bill_tags", () => {
  const billIds: string[] = [];
  const tagIds: string[] = [];

  afterEach(async () => {
    for (const id of billIds.splice(0)) await cleanupTestBill(id);
    for (const id of tagIds.splice(0)) await cleanupTestTag(id);
  });

  async function prepare() {
    const bill = await createTestBill();
    const oldTag = await createTestTag();
    const nextTag = await createTestTag();
    billIds.push(bill.id);
    tagIds.push(oldTag.id, nextTag.id);
    await createTestBillTag(bill.id, oldTag.id);
    return { bill, oldTag, nextTag };
  }

  it("既存タグを指定集合へ置換する", async () => {
    const { bill, oldTag, nextTag } = await prepare();
    const { error } = await adminClient.rpc("replace_bill_tags", {
      p_bill_id: bill.id,
      p_managed_tag_ids: [oldTag.id, nextTag.id],
      p_next_tag_ids: [nextTag.id, nextTag.id],
    });
    expect(error).toBeNull();

    const { data } = await adminClient
      .from("bills_tags")
      .select("tag_id")
      .eq("bill_id", bill.id);
    expect(data).toEqual([{ tag_id: nextTag.id }]);
  });

  it("存在しないタグで失敗した場合は既存タグを維持する", async () => {
    const { bill, oldTag } = await prepare();
    const { error } = await adminClient.rpc("replace_bill_tags", {
      p_bill_id: bill.id,
      p_managed_tag_ids: [oldTag.id],
      p_next_tag_ids: ["00000000-0000-0000-0000-000000000000"],
    });
    expect(error).not.toBeNull();

    const { data } = await adminClient
      .from("bills_tags")
      .select("tag_id")
      .eq("bill_id", bill.id);
    expect(data).toEqual([{ tag_id: oldTag.id }]);
  });

  it("AI管理対象ではないタグを維持する", async () => {
    const { bill, oldTag, nextTag } = await prepare();
    const manualTag = await createTestTag();
    tagIds.push(manualTag.id);
    await createTestBillTag(bill.id, manualTag.id);

    const { error } = await adminClient.rpc("replace_bill_tags", {
      p_bill_id: bill.id,
      p_managed_tag_ids: [oldTag.id, nextTag.id],
      p_next_tag_ids: [nextTag.id],
    });
    expect(error).toBeNull();

    const { data } = await adminClient
      .from("bills_tags")
      .select("tag_id")
      .eq("bill_id", bill.id);
    expect(new Set(data?.map((row) => row.tag_id))).toEqual(
      new Set([manualTag.id, nextTag.id])
    );
  });
});
