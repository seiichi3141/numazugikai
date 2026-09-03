const VOLATILE_INCAPSULA_SCRIPT =
  /<script\b[^>]*\bsrc=["']\/_Incapsula_Resource\?[^"']*["'][^>]*>\s*<\/script>/gi;

/** 取得ごとに変わるWAFスクリプトを除外し、本文変更だけをハッシュへ反映する。 */
export function normalizeHtmlForContentHash(html: string): string {
  return html.replace(VOLATILE_INCAPSULA_SCRIPT, "");
}
