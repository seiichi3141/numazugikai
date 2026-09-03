import { describe, expect, it } from "vitest";
import { chooseBillTags } from "./choose-bill-tags";

const bill = {
  name: "令和8年度沼津市一般会計補正予算",
  categoryLabel: "予算",
  title: null,
  summary: null,
  explanationSource: null,
};
const tags = [
  { id: "tag-1", label: "行財政・人事", description: "予算と決算" },
  { id: "tag-2", label: "子育て・教育", description: "学校と教育" },
];

describe("chooseBillTags", () => {
  it("AIが選んだ既存タグをIDへ変換し重複を除く", async () => {
    const selected = await chooseBillTags({
      bill,
      tags,
      generate: async ({ prompt }) => {
        expect(prompt).toContain("行財政・人事");
        return { labels: ["行財政・人事", "行財政・人事"] };
      },
    });

    expect(selected).toEqual([{ id: "tag-1", label: "行財政・人事" }]);
  });

  it("DBにないタグをAIが返したら保存対象にしない", async () => {
    await expect(
      chooseBillTags({
        bill,
        tags,
        generate: async () => ({ labels: ["国政"] }),
      })
    ).rejects.toThrow("タグ候補に無いラベル");
  });
});
