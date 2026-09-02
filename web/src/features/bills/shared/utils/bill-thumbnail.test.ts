import { existsSync } from "node:fs";
import path from "node:path";
import { tags as seedTags } from "@mirai-gikai/seed/main/data";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BILL_THUMBNAIL,
  resolveBillThumbnail,
  TAG_THUMBNAILS,
} from "./bill-thumbnail";

const tag = (label: string) => ({ label });

describe("resolveBillThumbnail", () => {
  it("アップロード済みの画像があればタグより優先する", () => {
    expect(
      resolveBillThumbnail({
        thumbnail_url: "https://example.com/a.png",
        tags: [tag("産業・観光")],
      })
    ).toBe("https://example.com/a.png");
  });

  it("画像が無ければ分野タグに対応するイラストを返す", () => {
    expect(
      resolveBillThumbnail({ thumbnail_url: null, tags: [tag("防災・安全")] })
    ).toBe("/img/bill-thumbnails/safety.webp");
  });

  it("複数タグの議案は、タグの並び順に関わらず同じ画像になる", () => {
    const forward = resolveBillThumbnail({
      thumbnail_url: null,
      tags: [tag("行財政・人事"), tag("子育て・教育")],
    });
    const reversed = resolveBillThumbnail({
      thumbnail_url: null,
      tags: [tag("子育て・教育"), tag("行財政・人事")],
    });
    expect(forward).toBe("/img/bill-thumbnails/education.webp");
    expect(reversed).toBe(forward);
  });

  it.each([
    ["タグなし", []],
    ["未知のタグ", [tag("その他")]],
  ])("%s の議案は汎用画像になる", (_, tags) => {
    expect(resolveBillThumbnail({ thumbnail_url: null, tags })).toBe(
      DEFAULT_BILL_THUMBNAIL
    );
  });
});

describe("分野タグとの対応", () => {
  /*
    タグは DB のラベルで突き合わせるので、seed のタグ名を変えると該当議案が
    黙って汎用画像に落ちる。ここで名前と並び（featured_priority 順）を固定し、
    ずれたらテストで気づけるようにする。
  */
  it("seed のタグ名と並び順に一致する", () => {
    const seedLabels = seedTags
      .flatMap((tag) =>
        tag.featured_priority == null
          ? []
          : [{ label: tag.label, priority: tag.featured_priority }]
      )
      .sort((a, b) => a.priority - b.priority)
      .map(({ label }) => label);
    expect(TAG_THUMBNAILS.map(({ label }) => label)).toEqual(seedLabels);
  });
});

describe("フォールバック画像のアセット", () => {
  const publicDir = path.resolve(__dirname, "../../../../../public");

  const srcs = [
    ...TAG_THUMBNAILS.map(({ src }) => src),
    DEFAULT_BILL_THUMBNAIL,
  ];

  it.each(srcs)("%s が public に存在する", (src) => {
    expect(existsSync(path.join(publicDir, src))).toBe(true);
  });
});
