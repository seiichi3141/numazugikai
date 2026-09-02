import { describe, expect, it } from "vitest";
import { searchBills } from "./search-bills";

function bill(
  id: string,
  overrides: {
    name?: string;
    title?: string | null;
    summary?: string | null;
    tags?: string[];
  } = {}
) {
  return {
    id,
    name: overrides.name ?? "沼津市国民健康保険税条例の一部を改正する条例",
    bill_content:
      overrides.title === null && overrides.summary === null
        ? undefined
        : ({
            title: overrides.title ?? "保険料の負担を軽くする",
            summary: overrides.summary ?? "税率を引き下げます。",
          } as never),
    tags: (overrides.tags ?? ["税金"]).map((label) => ({ id: label, label })),
  };
}

const ids = (bills: { id: string }[]) => bills.map((b) => b.id);

describe("searchBills", () => {
  it("正式名称に当てる", () => {
    expect(ids(searchBills([bill("a")], "国民健康保険税条例"))).toEqual(["a"]);
  });

  it("わかりやすいタイトルに当てる", () => {
    expect(ids(searchBills([bill("a")], "負担"))).toEqual(["a"]);
  });

  it("要約に当てる", () => {
    expect(ids(searchBills([bill("a")], "税率"))).toEqual(["a"]);
  });

  // カテゴリ名で探す利用者がいる。
  it("タグ名に当てる", () => {
    expect(
      ids(searchBills([bill("a", { tags: ["暮らし"] })], "暮らし"))
    ).toEqual(["a"]);
  });

  it("一致しなければ空", () => {
    expect(searchBills([bill("a")], "宇宙")).toEqual([]);
  });

  it("空クエリは絞り込まない", () => {
    const bills = [bill("a"), bill("b")];
    expect(ids(searchBills(bills, ""))).toEqual(["a", "b"]);
    expect(ids(searchBills(bills, "   "))).toEqual(["a", "b"]);
  });

  // 「AI」を「ＡＩ」と打つ利用者を取りこぼさない。
  it("全角と半角を同一視する", () => {
    const target = bill("a", { title: "AIを活用して窓口を便利にする" });
    expect(ids(searchBills([target], "ＡＩ"))).toEqual(["a"]);
    expect(ids(searchBills([target], "ai"))).toEqual(["a"]);
  });

  it("クエリ中の空白を無視する", () => {
    expect(ids(searchBills([bill("a")], "負担 を軽く"))).toEqual(["a"]);
  });

  it("bill_content が無くても落ちない", () => {
    const target = bill("a", { title: null, summary: null });
    expect(ids(searchBills([target], "国民健康保険税条例"))).toEqual(["a"]);
    expect(searchBills([target], "負担")).toEqual([]);
  });

  it("元の配列を壊さない", () => {
    const input = [bill("a")];
    searchBills(input, "").push(bill("b"));
    expect(input).toHaveLength(1);
  });
});
