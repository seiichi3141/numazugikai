import { describe, expect, it } from "vitest";
import { chooseThumbnailKey } from "./choose-thumbnail-key";

const bill = {
  name: "令和８年度沼津市一般会計補正予算（第２号）",
  categoryLabel: "予算",
  title: null,
  summary: null,
};

describe("chooseThumbnailKey", () => {
  it("生成部にプロンプトを渡し、返った key をそのまま返す", async () => {
    const prompts: string[] = [];
    const key = await chooseThumbnailKey({
      bill,
      generate: async ({ prompt }) => {
        prompts.push(prompt);
        return { key: "budget" };
      },
    });

    expect(key).toBe("budget");
    expect(prompts[0]).toContain(bill.name);
  });

  it("題材一覧に無い key が返ったら保存せず失敗にする", async () => {
    await expect(
      chooseThumbnailKey({
        bill,
        generate: async () => ({ key: "money" }),
      })
    ).rejects.toThrow("題材一覧に無い key");
  });
});
