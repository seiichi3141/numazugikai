import { Fragment, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBillOgData } from "@/features/bills/server/loaders/get-bill-og-data";
import { OgFrame } from "@/lib/og/og-frame";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getBillOgData: vi.fn(),
  imageResponse: vi.fn(
    (element: ReactElement, _init: ConstructorParameters<typeof Response>[1]) =>
      new Response(JSON.stringify(element), { status: 200 })
  ),
}));

vi.mock("@/features/bills/server/loaders/get-bill-og-data", () => ({
  getBillOgData: mocks.getBillOgData,
}));

vi.mock("next/og", () => ({
  ImageResponse: mocks.imageResponse,
}));

const sample = {
  title: "市営墓地の使用料を見直し",
  summary: "市営墓地の使用料と管理料を改定する議案です",
  meta: ["議第63号", "2026.6.29 提出"],
  status: "可決",
  tags: ["暮らし・まちづくり"],
};

function stubFontFetchFailure() {
  // フォント取得は失敗させて既定フォントに落とす（ネットワークに出ない）
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("", { status: 500 }))
  );
}

describe("GET /api/og/bill", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("id が無ければ 400", async () => {
    const res = await GET(new Request("http://localhost/api/og/bill"));
    expect(res.status).toBe(400);
    expect(mocks.imageResponse).not.toHaveBeenCalled();
  });

  it("議案が無ければ 404", async () => {
    vi.mocked(getBillOgData).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/og/bill?id=x"));
    expect(res.status).toBe(404);
  });

  it("タイトル・要約・状態・番号・提出日・タグを共通の枠に描く", async () => {
    vi.mocked(getBillOgData).mockResolvedValue(sample);
    stubFontFetchFailure();

    await GET(new Request("http://localhost/api/og/bill?id=bill-1"));

    const [element, init] = mocks.imageResponse.mock.calls[0];
    const json = JSON.stringify(element);
    for (const text of [
      "市営墓地の使用料を見直し",
      "市営墓地の使用料と管理料を改定する議案です",
      "可決",
      "議第63号",
      "2026.6.29 提出",
      "暮らし・まちづくり",
    ]) {
      expect(json).toContain(text);
    }
    // サービス名バッジとロゴは共通の枠が持つ
    expect(element.type).toBe(OgFrame);
    // Satori はフラグメントを展開できない。枠の中身は1つの div にする
    const body = (element as ReactElement<{ children: ReactElement }>).props
      .children;
    expect(body.type).not.toBe(Fragment);
    expect(body.type).toBe("div");
    expect(init).toMatchObject({ width: 1200, height: 630 });
  });

  it("版付きの URL は長期キャッシュ、版なしは短め", async () => {
    vi.mocked(getBillOgData).mockResolvedValue(sample);
    stubFontFetchFailure();

    await GET(new Request("http://localhost/api/og/bill?id=b&v=123"));
    await GET(new Request("http://localhost/api/og/bill?id=b"));

    const [, withVersion] = mocks.imageResponse.mock.calls[0];
    const [, withoutVersion] = mocks.imageResponse.mock.calls[1];
    expect(withVersion?.headers).toMatchObject({
      "Cache-Control": expect.stringContaining("immutable"),
    });
    expect(withoutVersion?.headers).toMatchObject({
      "Cache-Control": expect.not.stringContaining("immutable"),
    });
  });

  it("フォント取得に失敗しても画像を返す", async () => {
    vi.mocked(getBillOgData).mockResolvedValue(sample);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const res = await GET(
      new Request("http://localhost/api/og/bill?id=bill-1")
    );

    expect(res.status).toBe(200);
    const [, init] = mocks.imageResponse.mock.calls[0];
    expect(init).not.toHaveProperty("fonts");
  });

  it("文章ブロックに wordBreak を付けない", async () => {
    // 見出しと要約の両方に break-all を付けると Satori の改行処理が無限ループし、
    // サーバーごと応答しなくなる。style を走査して混入を防ぐ
    vi.mocked(getBillOgData).mockResolvedValue(sample);
    stubFontFetchFailure();

    await GET(new Request("http://localhost/api/og/bill?id=bill-1"));

    const [element] = mocks.imageResponse.mock.calls[0];
    expect(JSON.stringify(element)).not.toContain('"wordBreak"');
  });
});
