import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OG_COLORS } from "@/lib/og/og-colors";
import { SiteOgContent } from "@/lib/og/site-og-content";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  imageResponse: vi.fn(
    (element: ReactElement, _init: ConstructorParameters<typeof Response>[1]) =>
      new Response(JSON.stringify(element), { status: 200 })
  ),
}));

vi.mock("next/og", () => ({
  ImageResponse: mocks.imageResponse,
}));

describe("GET /api/og/site", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("ロゴとプレビューを渡した 1200x630 の画像を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 500 }))
    );

    const res = await GET();

    expect(res.status).toBe(200);
    const [element, init] = mocks.imageResponse.mock.calls[0];
    expect(element.props).toMatchObject({
      showBrandChrome: false,
      contentBackgroundImage: OG_COLORS.siteBackgroundSea,
    });
    const content = (element as ReactElement<{ children: ReactElement }>).props
      .children;
    expect(content.type).toBe(SiteOgContent);
    expect(content.props).toMatchObject({
      logoDataUrl: expect.stringContaining("data:image/png;base64,"),
      screenshotDataUrl: expect.stringContaining("data:image/png;base64,"),
    });
    expect(init).toMatchObject({ width: 1200, height: 630 });
  });
});
