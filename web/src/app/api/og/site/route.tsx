import { OG_COLORS } from "@/lib/og/og-colors";
import { renderOgImage } from "@/lib/og/render-og-image";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

// 入力が無いのでビルド時に1回だけ描き、静的に配る
export const dynamic = "force-static";

/**
 * サイト全体の OGP 画像。トップや一覧など、議案に紐づかないページで使う。
 *
 * 以前は富士山のイラストだけの静的画像で、サービス名が入っておらず
 * SNS のカードに何のサイトか出なかった。
 */
export async function GET() {
  return renderOgImage(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        flex: 1,
        width: 860,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 64,
          color: OG_COLORS.primary,
          letterSpacing: "0.02em",
          marginBottom: 24,
        }}
      >
        {SITE_NAME}
      </div>
      <div style={{ display: "flex", fontSize: 30, lineHeight: 1.6 }}>
        {SITE_DESCRIPTION}
      </div>
    </div>
  );
}
