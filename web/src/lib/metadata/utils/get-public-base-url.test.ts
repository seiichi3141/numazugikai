import { describe, expect, it } from "vitest";
import { getPublicBaseUrl } from "./get-public-base-url";

describe("getPublicBaseUrl", () => {
  it("末尾のスラッシュを除いたoriginを返す", () => {
    expect(getPublicBaseUrl("https://mirai-numazu.com/")).toBe(
      "https://mirai-numazu.com"
    );
  });

  it("パスが渡されてもoriginだけを返す", () => {
    expect(getPublicBaseUrl("https://example.vercel.app/path")).toBe(
      "https://example.vercel.app"
    );
  });
});
