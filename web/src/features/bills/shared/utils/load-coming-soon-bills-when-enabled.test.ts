import { describe, expect, it } from "vitest";
import { loadComingSoonBillsWhenEnabled } from "./load-coming-soon-bills-when-enabled";

describe("loadComingSoonBillsWhenEnabled", () => {
  it("無効なら取得処理を呼ばずにnullを返す", async () => {
    let called = false;

    const result = await loadComingSoonBillsWhenEnabled({
      enabled: false,
      load: async () => {
        called = true;
        return [];
      },
    });

    expect(result).toBeNull();
    expect(called).toBe(false);
  });

  it("有効なら取得した議案を返す", async () => {
    const bills = [
      {
        id: "bill-1",
        name: "条例案",
        title: "条例を改正",
        bill_number: "議第1号",
        source_url: null,
      },
    ];
    const result = await loadComingSoonBillsWhenEnabled({
      enabled: true,
      load: async () => bills,
    });

    expect(result).toEqual(bills);
  });
});
