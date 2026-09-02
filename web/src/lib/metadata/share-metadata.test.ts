import { describe, expect, it } from "vitest";
import { buildShareMetadata } from "./share-metadata";

const base = {
  title: "議案A",
  description: "説明",
  canonical: "/bills/a",
  image: "https://example.com/api/og/bill?id=a",
  imageAlt: "議案A のOGPイメージ",
};

describe("buildShareMetadata", () => {
  it("openGraph と twitter に同じ画像と文言を入れる", () => {
    const m = buildShareMetadata(base);
    expect(m.openGraph).toMatchObject({
      title: "議案A",
      description: "説明",
      type: "website",
      images: [{ url: base.image, alt: base.imageAlt }],
    });
    expect(m.twitter).toMatchObject({
      card: "summary_large_image",
      title: "議案A",
      images: [base.image],
    });
    expect(m.alternates).toEqual({ canonical: "/bills/a" });
  });

  it("article のときだけ日時を付ける", () => {
    const m = buildShareMetadata({
      ...base,
      type: "article",
      publishedTime: "2026-06-01",
      modifiedTime: "2026-06-02",
    });
    expect(m.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-06-01",
      modifiedTime: "2026-06-02",
    });
  });

  it("website のときは日時を付けない", () => {
    const m = buildShareMetadata({ ...base, publishedTime: "2026-06-01" });
    expect(m.openGraph).not.toHaveProperty("publishedTime");
  });
});
