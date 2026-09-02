import { describe, expect, it } from "vitest";
import { getBillOgVersion } from "./get-bill-og-version";

const at = "2026-06-01T00:00:00Z";
const ts = String(Date.parse(at));

describe("getBillOgVersion", () => {
  it("議案本体の更新日時を版にする", () => {
    expect(getBillOgVersion({ updated_at: at })).toBe(ts);
  });

  it("解説の方が新しければそちらを版にする", () => {
    // 解説を作り直しても議案本体の updated_at は動かないので、両方見る
    const later = "2026-06-05T00:00:00Z";
    expect(
      getBillOgVersion({ updated_at: at, bill_content: { updated_at: later } })
    ).toBe(String(Date.parse(later)));
  });

  it("解説が無くても壊れない", () => {
    expect(getBillOgVersion({ updated_at: at, bill_content: null })).toBe(ts);
  });

  it("不正な日付は無視する", () => {
    expect(getBillOgVersion({ updated_at: "invalid" })).toBe("0");
  });

  describe("タグ", () => {
    it("タグの付け替えで版が変わる", () => {
      // タグを変えても議案の updated_at は動かない。画像には載るので版に含める
      const a = getBillOgVersion({
        updated_at: at,
        tags: [{ id: "1", label: "暮らし" }],
      });
      const b = getBillOgVersion({
        updated_at: at,
        tags: [{ id: "2", label: "防災" }],
      });
      expect(a).not.toBe(b);
    });

    it("タグの名称変更で版が変わる", () => {
      const a = getBillOgVersion({
        updated_at: at,
        tags: [{ id: "1", label: "暮らし" }],
      });
      const b = getBillOgVersion({
        updated_at: at,
        tags: [{ id: "1", label: "暮らし・まちづくり" }],
      });
      expect(a).not.toBe(b);
    });

    it("タグの順序が違うだけなら同じ版", () => {
      const a = getBillOgVersion({
        updated_at: at,
        tags: [
          { id: "1", label: "a" },
          { id: "2", label: "b" },
        ],
      });
      const b = getBillOgVersion({
        updated_at: at,
        tags: [
          { id: "2", label: "b" },
          { id: "1", label: "a" },
        ],
      });
      expect(a).toBe(b);
    });

    it("版は URL に載せられる文字だけ", () => {
      const v = getBillOgVersion({
        updated_at: at,
        tags: [{ id: "1", label: "暮らし" }],
      });
      expect(v).toMatch(/^[0-9a-z-]+$/);
    });
  });
});
