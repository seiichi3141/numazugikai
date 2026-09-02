import { describe, expect, it } from "vitest";
import { billExplanationSchema } from "./schemas";

const VALID = {
  title: "コンビニで印鑑証明を取れるカードが増えます",
  summary:
    "コンビニのマルチコピー機で印鑑登録証明書を受け取れる本人確認書類に、外国人住民向けのカードが加わります。",
  content: "## どんな議案か\n\n" + "本文".repeat(60),
};

describe("billExplanationSchema", () => {
  it("妥当な解説を受け入れる", () => {
    expect(billExplanationSchema.parse(VALID)).toEqual(VALID);
  });

  it("タイトルが長すぎるものは弾く", () => {
    const result = billExplanationSchema.safeParse({
      ...VALID,
      title: "あ".repeat(61),
    });
    expect(result.success).toBe(false);
  });

  it("要約が短すぎる・長すぎるものは弾く", () => {
    expect(
      billExplanationSchema.safeParse({ ...VALID, summary: "短い" }).success
    ).toBe(false);
    expect(
      billExplanationSchema.safeParse({ ...VALID, summary: "あ".repeat(201) })
        .success
    ).toBe(false);
  });

  it("本文が薄すぎるものは弾く", () => {
    // 中身のない解説を保存してしまわないよう下限を設ける
    expect(
      billExplanationSchema.safeParse({ ...VALID, content: "短い解説" }).success
    ).toBe(false);
  });

  it("項目が欠けているものは弾く", () => {
    expect(
      billExplanationSchema.safeParse({ title: VALID.title }).success
    ).toBe(false);
  });
});
