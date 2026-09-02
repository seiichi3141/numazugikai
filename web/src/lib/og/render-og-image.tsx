import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { loadOgFont, loadOgLogo } from "./load-og-assets";
import { OgFrame } from "./og-frame";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/**
 * OGP 画像を描いて返す。フォントとロゴの読み込み、共通の枠、サイズ、
 * キャッシュヘッダーをここで一括して持つ。各ルートは中身だけを渡す。
 *
 * `immutable` は URL に版が入っている（内容が変われば URL も変わる）ときに
 * 使う。版が無い URL は短めにして、内容の更新が反映されるようにする。
 */
export async function renderOgImage(
  children: ReactNode,
  { immutable = false }: { immutable?: boolean } = {}
): Promise<ImageResponse> {
  const [fontData, logoDataUrl] = await Promise.all([
    loadOgFont(),
    loadOgLogo(),
  ]);

  return new ImageResponse(
    <OgFrame logoDataUrl={logoDataUrl}>{children}</OgFrame>,
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      // フォント取得に失敗したときはプロパティ自体を省略し、既定フォントに落とす
      ...(fontData
        ? {
            fonts: [
              {
                name: "Noto Sans JP",
                data: fontData,
                style: "normal" as const,
                weight: 800 as const,
              },
            ],
          }
        : {}),
      headers: {
        "Cache-Control": immutable
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600, s-maxage=600, stale-while-revalidate=86400",
      },
    }
  );
}
