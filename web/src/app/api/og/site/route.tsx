import { loadOgLogo, loadOgSiteScreenshot } from "@/lib/og/load-og-assets";
import { OG_COLORS } from "@/lib/og/og-colors";
import { renderOgImage } from "@/lib/og/render-og-image";
import { SiteOgContent } from "@/lib/og/site-og-content";

/** サイト共通の OGP をリクエスト時に生成する。 */
export async function GET() {
  const [screenshotDataUrl, logoDataUrl] = await Promise.all([
    loadOgSiteScreenshot(),
    loadOgLogo(),
  ]);

  return renderOgImage(
    <SiteOgContent
      logoDataUrl={logoDataUrl}
      screenshotDataUrl={screenshotDataUrl}
    />,
    {
      showBrandChrome: false,
      contentBackgroundImage: OG_COLORS.siteBackgroundSea,
    }
  );
}
