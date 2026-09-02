import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";
import { OG_COLORS } from "./og-colors";

/**
 * OGP 画像の共通の枠。
 *
 * グラデーションの縁取りと白いカード、右上のサービス名、右下のロゴを持つ。
 * 議案・レポート・サイト全体で同じ枠にして、SNS 上で同じサービスだと分かる
 * ようにする。中身だけ差し替える。
 *
 * next/og（Satori）は flex しか扱えないので、すべての div に display:flex
 * を明示する。文字の太さと色はここで一度だけ指定し、中身は継承に任せる。
 * 読み込むフォントは太さ 800 だけなので、他の太さを指定しても効かない。
 */
export function OgFrame({
  logoDataUrl,
  children,
  showBrandChrome = true,
  contentBackgroundImage,
}: {
  logoDataUrl: string | null;
  children: ReactNode;
  /** サイト OGP は本文全体がブランド表現になるため、角のバッジとロゴを隠す */
  showBrandChrome?: boolean;
  /** サイト OGP の背景。未指定時は既存カード色を使う */
  contentBackgroundImage?: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: OG_COLORS.pageBackground,
        fontWeight: 800,
        color: OG_COLORS.text,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 1140,
          height: 560,
          borderRadius: 30,
          backgroundImage: OG_COLORS.gradient,
          padding: 6,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            backgroundColor: OG_COLORS.card,
            backgroundImage: contentBackgroundImage,
            borderRadius: 24,
            padding: "48px 56px",
          }}
        >
          {children}
        </div>

        {showBrandChrome && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              paddingLeft: 20,
              paddingRight: 18,
              paddingTop: 10,
              paddingBottom: 10,
              borderBottomLeftRadius: 30,
              borderTopRightRadius: 30,
              backgroundImage: OG_COLORS.gradient,
            }}
          >
            <span style={{ fontSize: 28, letterSpacing: "0.03em" }}>
              {SITE_NAME}
            </span>
          </div>
        )}

        {showBrandChrome && logoDataUrl && (
          // biome-ignore lint/performance/noImgElement: next/og は img 要素しか描画できない
          <img
            alt={`${SITE_NAME}のロゴ`}
            src={logoDataUrl}
            width={160}
            height={160}
            style={{ position: "absolute", bottom: -24, right: -18 }}
          />
        )}
      </div>
    </div>
  );
}
