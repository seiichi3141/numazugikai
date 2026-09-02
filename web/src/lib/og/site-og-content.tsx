import { OG_COLORS } from "./og-colors";

function BrandMessage({ logoDataUrl }: { logoDataUrl: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: 650,
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 21,
          color: OG_COLORS.primaryAccent,
          letterSpacing: "0.12em",
          marginBottom: 16,
        }}
      >
        NUMAZU CITY COUNCIL GUIDE
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        {logoDataUrl && (
          // biome-ignore lint/performance/noImgElement: next/og は img 要素しか描画できない
          <img
            alt="みらい議会＠沼津市のロゴ"
            src={logoDataUrl}
            width={124}
            height={124}
            style={{ marginRight: 24 }}
          />
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 66,
            lineHeight: 1.12,
            letterSpacing: "0.02em",
          }}
        >
          <span style={{ display: "flex" }}>みらい議会</span>
          <span style={{ display: "flex", color: OG_COLORS.primary }}>
            ＠沼津市
          </span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 590,
          marginTop: 24,
          fontSize: 36,
          lineHeight: 1.35,
          color: OG_COLORS.textSecondary,
        }}
      >
        <span style={{ display: "flex" }}>沼津市議会の動きを、</span>
        <span style={{ display: "flex", color: OG_COLORS.primary }}>
          身近な言葉で。
        </span>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 18,
          fontSize: 22,
          color: OG_COLORS.primaryAccent,
          letterSpacing: "0.04em",
        }}
      >
        議案を知る　・　探す　・　審議を追う
      </div>
      <div
        style={{
          display: "flex",
          width: 570,
          marginTop: 22,
          paddingTop: 10,
          borderTop: `2px solid ${OG_COLORS.border}`,
          fontSize: 20,
          color: OG_COLORS.textMuted,
        }}
      >
        沼津市・沼津市議会の公式サービスではありません
      </div>
    </div>
  );
}

function SmartphonePreview({
  screenshotDataUrl,
}: {
  screenshotDataUrl: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        width: 365,
        height: 743,
        top: -34,
        right: 10,
        padding: 10,
        borderRadius: 62,
        backgroundColor: OG_COLORS.phoneFrame,
        border: `3px solid ${OG_COLORS.phoneFrameHighlight}`,
        boxShadow: `0 12px 28px ${OG_COLORS.phoneFrameShadow}`,
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 10,
          left: 10,
          width: 339,
          height: 719,
          overflow: "hidden",
          borderRadius: 50,
          backgroundColor: OG_COLORS.card,
        }}
      >
        {screenshotDataUrl && (
          // biome-ignore lint/performance/noImgElement: next/og は img 要素しか描画できない
          <img
            alt="みらい議会＠沼津市のモバイル表示"
            src={screenshotDataUrl}
            width={339}
            height={719}
            style={{
              position: "absolute",
              top: 36,
              left: 0,
              objectFit: "cover",
            }}
          />
        )}
      </div>
      <div
        role="img"
        aria-label="スマートフォンフレーム"
        style={{
          display: "flex",
          position: "absolute",
          top: 20,
          left: 130,
          width: 105,
          height: 28,
          borderRadius: 16,
          backgroundColor: OG_COLORS.phoneFrame,
        }}
      />
    </div>
  );
}

/** サイト共通 OGP の、ブランドコピーと実サイトのモバイル表示。 */
export function SiteOgContent({
  logoDataUrl,
  screenshotDataUrl,
}: {
  logoDataUrl: string | null;
  screenshotDataUrl: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flex: 1,
        width: "100%",
        position: "relative",
      }}
    >
      <BrandMessage logoDataUrl={logoDataUrl} />
      <SmartphonePreview screenshotDataUrl={screenshotDataUrl} />
    </div>
  );
}
