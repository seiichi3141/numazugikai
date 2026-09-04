export type GeneralQuestionPdfLink = {
  url: string;
  label: string;
};

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 本会議報告ページから一般質問資料のPDFだけを重複なく抽出する。 */
export function parseGeneralQuestionIndexHtml(
  html: string,
  pageUrl: string
): GeneralQuestionPdfLink[] {
  const links = new Map<string, GeneralQuestionPdfLink>();
  for (const match of html.matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const href = match[1].trim();
    const label = decodeHtml(match[2]);
    if (!/\.pdf(?:[?#]|$)/i.test(href)) continue;
    if (!/一般質問|代表質問|個人質問/.test(`${label} ${href}`)) continue;
    const url = new URL(href, pageUrl).toString();
    links.set(url, { url, label: label || "一般質問資料" });
  }
  return [...links.values()];
}
