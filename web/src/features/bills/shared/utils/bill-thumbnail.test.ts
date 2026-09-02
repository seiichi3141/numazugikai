import { existsSync } from "node:fs";
import path from "node:path";
import { tags as seedTags } from "@mirai-gikai/seed/main/data";
import {
  BILL_THUMBNAIL_SUBJECTS,
  TAG_DEFAULT_SUBJECTS,
} from "@mirai-gikai/shared/bill-thumbnail/subjects";
import { describe, expect, it } from "vitest";
import { resolveBillThumbnail, subjectThumbnailSrc } from "./bill-thumbnail";

const tag = (label: string) => ({ label });
const noTags: { label: string }[] = [];

describe("resolveBillThumbnail", () => {
  it("アップロード済みの画像があれば題材より優先する", () => {
    expect(
      resolveBillThumbnail({
        thumbnail_url: "https://example.com/a.png",
        thumbnail_key: "budget",
        tags: [tag("産業・観光")],
      })
    ).toBe("https://example.com/a.png");
  });

  it("題材が決まっていればその画像を返す", () => {
    expect(
      resolveBillThumbnail({
        thumbnail_url: null,
        thumbnail_key: "school-lunch",
        tags: [tag("防災・安全")],
      })
    ).toBe("/img/bill-thumbnails/school-lunch.webp");
  });

  it.each([
    ["port", "/img/bill-thumbnails/port-numazu-v1.webp"],
    ["river", "/img/bill-thumbnails/river-numazu-v1.webp"],
    ["road", "/img/bill-thumbnails/road-numazu-v1.webp"],
    ["tourism", "/img/bill-thumbnails/tourism-numazu-v1.webp"],
  ])("地域写真ベースの %s はバージョン付き画像を返す", (key, expected) => {
    expect(
      resolveBillThumbnail({
        thumbnail_url: null,
        thumbnail_key: key,
        tags: [],
      })
    ).toBe(expected);
  });

  it("題材が一覧に無い値なら無視してタグから決める", () => {
    expect(
      resolveBillThumbnail({
        thumbnail_url: null,
        thumbnail_key: "removed-subject",
        tags: [tag("防災・安全")],
      })
    ).toBe("/img/bill-thumbnails/disaster.webp");
  });

  it("複数タグの議案は、タグの並び順に関わらず同じ画像になる", () => {
    const forward = resolveBillThumbnail({
      thumbnail_url: null,
      thumbnail_key: null,
      tags: [tag("行財政・人事"), tag("子育て・教育")],
    });
    const reversed = resolveBillThumbnail({
      thumbnail_url: null,
      thumbnail_key: null,
      tags: [tag("子育て・教育"), tag("行財政・人事")],
    });
    expect(forward).toBe("/img/bill-thumbnails/education-general.webp");
    expect(reversed).toBe(forward);
  });

  it.each([
    ["タグなし", noTags],
    ["未知のタグ", [tag("その他")]],
  ])("題材もなく %s の議案は汎用画像になる", (_, tags) => {
    expect(
      resolveBillThumbnail({ thumbnail_url: null, thumbnail_key: null, tags })
    ).toBe("/img/bill-thumbnails/general.webp");
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
    expect(TAG_DEFAULT_SUBJECTS.map(({ label }) => label)).toEqual(seedLabels);
  });
});

describe("題材画像のアセット", () => {
  const publicDir = path.resolve(__dirname, "../../../../../public");

  it.each(
    BILL_THUMBNAIL_SUBJECTS.map((subject) => subject.key)
  )("%s の画像が public に存在する", (key) => {
    expect(existsSync(path.join(publicDir, subjectThumbnailSrc(key)))).toBe(
      true
    );
  });
});
