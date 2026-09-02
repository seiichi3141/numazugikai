import { getBillOgData } from "@/features/bills/server/loaders/get-bill-og-data";
import { OG_COLORS } from "@/lib/og/og-colors";
import { renderOgImage } from "@/lib/og/render-og-image";

/** 見出しの幅。右下のロゴと重ならない範囲 */
const TITLE_WIDTH = 900;
/** 見出しは3行まで。それ以上は overflow で切る */
const TITLE_MAX_HEIGHT = 3 * 42 * 1.5;

/*
 * 見出しと要約に wordBreak: "break-all" を付けてはいけない。
 * 2つの文章ブロックが縦に並ぶと Satori の改行処理が無限ループし、
 * サーバー全体が CPU 100% で応答しなくなる（Next の外でも再現）。
 * 日本語は文字単位で折り返せるので無くても困らない。長い英数字の列は
 * overflow: hidden で切れる。
 */

/**
 * 議案の OGP 画像。
 *
 * SNS に貼られたときに、何の議案でどうなったかが画像だけで分かるようにする。
 * わかりやすいタイトル、議決の状態、番号と提出日、要約、分野のタグを載せる。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const billId = searchParams.get("id");
  if (!billId) {
    return new Response("Missing id parameter", { status: 400 });
  }

  const ogText = await getBillOgData(billId);
  if (!ogText) {
    return new Response("Bill not found", { status: 404 });
  }

  return renderOgImage(
    // フラグメントで渡してはいけない。Satori はフラグメントを展開できず、
    // 要素が消えたり親のレイアウトに漏れたりする。必ず1つの div で包む
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        width: "100%",
      }}
    >
      {/* 議決の状態と番号・提出日 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 28,
          fontSize: 26,
        }}
      >
        <span
          style={{
            display: "flex",
            color: OG_COLORS.primaryAccent,
            backgroundColor: OG_COLORS.surfaceAccent,
            borderRadius: 999,
            padding: "6px 20px",
          }}
        >
          {ogText.status}
        </span>
        {ogText.meta.map((item) => (
          <span
            key={item}
            style={{ display: "flex", color: OG_COLORS.textMuted }}
          >
            {item}
          </span>
        ))}
      </div>

      {/* 見出し */}
      <div
        style={{
          display: "flex",
          width: TITLE_WIDTH,
          maxHeight: TITLE_MAX_HEIGHT,
          fontSize: 42,
          lineHeight: 1.5,
          overflow: "hidden",
        }}
      >
        {ogText.title}
      </div>

      {/* 要約。空でも描いて flex:1 でタグを下に押し下げる */}
      <div
        style={{
          display: "flex",
          flex: 1,
          width: TITLE_WIDTH,
          marginTop: 20,
          fontSize: 28,
          color: OG_COLORS.textSecondary,
          lineHeight: 1.6,
          overflow: "hidden",
        }}
      >
        {ogText.summary}
      </div>

      {/* 分野のタグ */}
      {ogText.tags.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 24,
            // 見出しと同じ幅に収め、はみ出す分は切る。右下のロゴに重ねない
            width: TITLE_WIDTH,
            overflow: "hidden",
          }}
        >
          {ogText.tags.map((tag) => (
            <span
              key={tag}
              style={{
                display: "flex",
                fontSize: 24,
                border: `2px solid ${OG_COLORS.border}`,
                borderRadius: 999,
                padding: "6px 18px",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>,
    // 版付きの URL で来たときだけ長期キャッシュにする
    { immutable: searchParams.has("v") }
  );
}
