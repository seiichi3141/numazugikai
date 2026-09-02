import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
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

  it("サービス名と説明を載せた 1200x630 の画像を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 500 }))
    );

    const res = await GET();

    expect(res.status).toBe(200);
    const [element, init] = mocks.imageResponse.mock.calls[0];
    const json = JSON.stringify(element);
    expect(json).toContain(SITE_NAME);
    expect(json).toContain(SITE_DESCRIPTION);
    expect(init).toMatchObject({ width: 1200, height: 630 });
  });
});
