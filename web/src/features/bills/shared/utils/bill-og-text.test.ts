import { describe, expect, it } from "vitest";
import { type BillOgSource, buildBillOgText } from "./bill-og-text";

const base: BillOgSource = {
  name: "沼津市営墓地条例の一部を改正する条例について",
  contentTitle: null,
  summary: null,
  billNumber: null,
  status: "passed",
  submittedDate: null,
  tags: [],
};

describe("buildBillOgText", () => {
  it("わかりやすいタイトルがあればそれを見出しにする", () => {
    const text = buildBillOgText({
      ...base,
      contentTitle: "市営墓地の使用料を見直し",
    });
    expect(text.title).toBe("市営墓地の使用料を見直し");
  });

  it("タイトルが無ければ正式名称を見出しにする", () => {
    expect(buildBillOgText(base).title).toBe(base.name);
  });

  it("タイトルが空白だけなら正式名称に倒す", () => {
    expect(buildBillOgText({ ...base, contentTitle: "  " }).title).toBe(
      base.name
    );
  });

  it("長い見出しは切り詰める", () => {
    const long = "あ".repeat(100);
    const text = buildBillOgText({ ...base, name: long });
    expect(text.title.length).toBeLessThan(long.length);
    expect(text.title.endsWith("...")).toBe(true);
  });

  it("議案番号と提出日をメタ情報にする", () => {
    // 日付の書式と JST 変換は formatDateWithDots 側で検証済み
    const text = buildBillOgText({
      ...base,
      billNumber: "議第63号",
      submittedDate: "2026-06-29",
    });
    expect(text.meta).toEqual(["議第63号", "2026.6.29 提出"]);
  });

  it("番号も提出日も無ければメタ情報は空", () => {
    expect(buildBillOgText(base).meta).toEqual([]);
  });

  it("ステータスは日本語ラベルにする", () => {
    expect(buildBillOgText({ ...base, status: "in_committee" }).status).toBe(
      "委員会で審査中"
    );
  });

  it("タグは3つまでに絞る", () => {
    const text = buildBillOgText({
      ...base,
      tags: [{ label: "a" }, { label: "b" }, { label: "c" }, { label: "d" }],
    });
    expect(text.tags).toEqual(["a", "b", "c"]);
  });

  it("長いタグ名は切り詰める", () => {
    // 管理画面で自由に付けられるので、長さに上限が無い
    const text = buildBillOgText({
      ...base,
      tags: [{ label: "あ".repeat(40) }],
    });
    expect(text.tags[0].length).toBeLessThan(40);
    expect(text.tags[0].endsWith("...")).toBe(true);
  });

  describe("要約", () => {
    it("要約を載せる", () => {
      expect(
        buildBillOgText({ ...base, summary: "使用料を見直す議案です" }).summary
      ).toBe("使用料を見直す議案です");
    });

    it("要約が無ければ空文字", () => {
      expect(buildBillOgText(base).summary).toBe("");
    });

    it("改行や連続する空白は1つの空白にする", () => {
      expect(
        buildBillOgText({ ...base, summary: "  一行目\n\n二行目  " }).summary
      ).toBe("一行目 二行目");
    });

    it("長い要約は切り詰める", () => {
      const text = buildBillOgText({ ...base, summary: "あ".repeat(200) });
      expect(text.summary.length).toBeLessThan(200);
      expect(text.summary.endsWith("...")).toBe(true);
    });
  });
});
