import { getBillOgData } from "@/features/bills/server/loaders/get-bill-og-data";
import { BillOgContent } from "@/lib/og/bill-og-content";
import { loadOgLogo } from "@/lib/og/load-og-assets";
import { OG_COLORS } from "@/lib/og/og-colors";
import { renderOgImage } from "@/lib/og/render-og-image";

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

  const logoDataUrl = await loadOgLogo();

  return renderOgImage(
    <BillOgContent logoDataUrl={logoDataUrl} {...ogText} />,
    // 版付きの URL で来たときだけ長期キャッシュにする
    {
      immutable: searchParams.has("v"),
      showBrandChrome: false,
      contentBackgroundImage: OG_COLORS.siteBackgroundSea,
    }
  );
}
