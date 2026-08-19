import { parseBillNumber } from "./parse-bill-number";

/** 議案本文PDFへのリンク1件 */
export type ParsedBillDocumentLink = {
  /** 正規化した議案番号（例: "議第58号"） */
  billNumber: string;
  /** リンク文言から議案番号と付記を除いた件名 */
  title: string;
  /** PDFのURL。baseUrl を渡した場合は絶対URL */
  url: string;
};

/** リンク文言の末尾に付く "（PDF：62KB）" を落とす。 */
function stripFileNote(text: string): string {
  return text.replace(/[（(]\s*PDF[：:][^）)]*[）)]\s*$/i, "").trim();
}

/** HTMLタグを落として実体参照を戻す。全角空白は半角にそろえる。 */
function toText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[\s　]+/g, " ")
    .trim();
}

/** 相対URLを baseUrl から絶対URLにする。base がなければそのまま返す。 */
function resolveUrl(href: string, baseUrl: string | null): string {
  if (!baseUrl) return href;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

/**
 * 沼津市議会「本会議のお知らせ」ページから、議案ごとの本文PDFリンクを取り出す。
 *
 * リンク文言は「議第58号　沼津市印鑑条例の一部改正について（PDF：62KB）」の形。
 * 議案番号で始まらないリンク（会期日程・一般質問など）は対象外にする。
 * 同じ議案番号が複数回現れた場合は最初のものを採る。
 */
export function parseBillDocumentLinks(
  html: string,
  baseUrl: string | null = null
): ParsedBillDocumentLink[] {
  const links: ParsedBillDocumentLink[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const href = match[1].trim();
    if (!/\.pdf(\?|#|$)/i.test(href)) continue;

    const label = stripFileNote(toText(match[2]));
    const parsedNumber = parseBillNumber(label);
    if (!parsedNumber) continue;
    if (seen.has(parsedNumber.billNumber)) continue;

    // 議案番号のあとに続く部分を件名として扱い、末尾の「について」は落とす
    const title = label
      .slice(label.indexOf("号") + 1)
      .trim()
      .replace(/について$/, "")
      .trim();

    seen.add(parsedNumber.billNumber);
    links.push({
      billNumber: parsedNumber.billNumber,
      title,
      url: resolveUrl(href, baseUrl),
    });
  }

  return links;
}
