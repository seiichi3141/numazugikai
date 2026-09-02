import { describe, expect, it } from "vitest";
import { buildRobots } from "./build-robots";

describe("buildRobots", () => {
  it("サイトマップを案内し、公開OGP APIをクロール可能にする", () => {
    const result = buildRobots("https://mirai-numazu.com");

    expect(result).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/dev/", "/preview/"],
      },
      sitemap: "https://mirai-numazu.com/sitemap.xml",
      host: "https://mirai-numazu.com",
    });
  });
});
