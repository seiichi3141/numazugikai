import type { MetadataRoute } from "next";

/** 公開ページとOGP画像を許可し、開発・プレビュー画面だけを除外する。 */
export function buildRobots(baseUrl: string): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dev/", "/preview/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
