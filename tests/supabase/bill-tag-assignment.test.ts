import { afterEach, describe, expect, it, vi } from "vitest";
import { runAssignBillTags } from "../../packages/bill-explainer/src/assign-bill-tags";
import {
  adminClient,
  cleanupTestBill,
  cleanupTestTag,
  createTestBill,
  createTestTag,
} from "./utils";

describe("AI議案タグ付け", () => {
  const billIds: string[] = [];
  const tagIds: string[] = [];

  afterEach(async () => {
    for (const id of billIds.splice(0)) await cleanupTestBill(id);
    for (const id of tagIds.splice(0)) await cleanupTestTag(id);
  });

  it("未分類だけを処理し、force時は既存タグを置換する", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const firstTag = await createTestTag({
      label: `AI分類A-${suffix}`,
      description: "AI分類テスト用A",
      featured_priority: 900_001,
    });
    const secondTag = await createTestTag({
      label: `AI分類B-${suffix}`,
      description: "AI分類テスト用B",
      featured_priority: 900_002,
    });
    const bill = await createTestBill({ name: `AI分類テスト議案-${suffix}` });
    tagIds.push(firstTag.id, secondTag.id);
    billIds.push(bill.id);

    const firstGenerate = vi.fn(async () => ({ labels: [firstTag.label] }));
    const first = await runAssignBillTags({
      billIds: [bill.id],
      generate: firstGenerate,
    });
    expect(first[0]?.labels).toEqual([firstTag.label]);

    const skippedGenerate = vi.fn(async () => ({ labels: [secondTag.label] }));
    const skipped = await runAssignBillTags({
      billIds: [bill.id],
      generate: skippedGenerate,
    });
    expect(skipped).toEqual([]);
    expect(skippedGenerate).not.toHaveBeenCalled();

    const replaced = await runAssignBillTags({
      billIds: [bill.id],
      force: true,
      generate: async () => ({ labels: [secondTag.label] }),
    });
    expect(replaced[0]?.labels).toEqual([secondTag.label]);

    const { data, error } = await adminClient
      .from("bills_tags")
      .select("tag_id")
      .eq("bill_id", bill.id);
    if (error) throw new Error(`タグ確認に失敗した: ${error.message}`);
    expect(data).toEqual([{ tag_id: secondTag.id }]);
  });
});
