import { SITE_NAME } from "@/lib/site";
import { OG_COLORS } from "./og-colors";

const TITLE_MAX_HEIGHT = 2 * 46 * 1.35;

export type BillOgContentProps = {
  logoDataUrl: string | null;
  title: string;
  summary: string;
  meta: string[];
  status: string;
  tags: string[];
};

/** トップページ OGP のブランド表現を踏襲した議案情報。 */
export function BillOgContent({
  logoDataUrl,
  title,
  summary,
  meta,
  status,
  tags,
}: BillOgContentProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          paddingBottom: 18,
          borderBottom: `2px solid ${OG_COLORS.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {logoDataUrl && (
            // biome-ignore lint/performance/noImgElement: next/og は img 要素しか描画できない
            <img
              alt={`${SITE_NAME}のロゴ`}
              src={logoDataUrl}
              width={58}
              height={58}
              style={{ marginRight: 16 }}
            />
          )}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              fontSize: 31,
              letterSpacing: "0.02em",
            }}
          >
            <span style={{ display: "flex" }}>みらい議会</span>
            <span style={{ display: "flex", color: OG_COLORS.primary }}>
              ＠沼津市
            </span>
          </div>
        </div>
        <span
          style={{
            display: "flex",
            fontSize: 18,
            color: OG_COLORS.primaryAccent,
            letterSpacing: "0.12em",
          }}
        >
          NUMAZU CITY COUNCIL GUIDE
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginTop: 22,
          fontSize: 22,
        }}
      >
        <span
          style={{
            display: "flex",
            color: OG_COLORS.card,
            backgroundColor: OG_COLORS.primary,
            borderRadius: 999,
            padding: "5px 18px",
          }}
        >
          {status}
        </span>
        {meta.map((item) => (
          <span
            key={item}
            style={{ display: "flex", color: OG_COLORS.textMuted }}
          >
            {item}
          </span>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          width: "100%",
          maxHeight: TITLE_MAX_HEIGHT,
          marginTop: 16,
          fontSize: 46,
          lineHeight: 1.35,
          overflow: "hidden",
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          width: "100%",
          maxHeight: 78,
          marginTop: 12,
          fontSize: 25,
          lineHeight: 1.55,
          color: OG_COLORS.textSecondary,
          overflow: "hidden",
        }}
      >
        {summary}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          marginTop: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            width: 560,
            overflow: "hidden",
          }}
        >
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                display: "flex",
                flexShrink: 0,
                fontSize: 20,
                color: OG_COLORS.primaryAccent,
                backgroundColor: OG_COLORS.surfaceAccent,
                borderRadius: 999,
                padding: "5px 16px",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
        <span
          style={{
            display: "flex",
            fontSize: 17,
            color: OG_COLORS.textMuted,
          }}
        >
          沼津市・沼津市議会の公式サービスではありません
        </span>
      </div>
    </div>
  );
}
