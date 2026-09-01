/** 会議記録検索の結果1件 */
export type AmivoiceSearchHit = {
  /** 会議記録の識別子（例: v20190606_01） */
  vcsv: string;
  /** ISO 8601 の開催日 */
  date: string;
  /** 会議名（例: 文教産業委員会） */
  meetingName: string;
};

/**
 * 会議記録検索（process=search_detail）の結果ページを解析する。
 *
 * 結果は `［ 1］ 2019/06/20 文教産業委員会 …` の形で並び、
 * 各行に `DataSubmit2('v20190620_01.vcsv', …)` のリンクが付く。
 *
 * 注意: この検索は該当件数（「69件の文書」）より少ない件数しか一覧に出さない。
 * 全件を取る方法は見つかっていないため、ここで得られるのは部分集合である。
 * 詳細は docs/20260902_0030_沼津市議会データソース調査ノート.md を参照。
 */
export function parseAmivoiceSearchResult(html: string): AmivoiceSearchHit[] {
  const hits: AmivoiceSearchHit[] = [];
  const seen = new Set<string>();

  // 結果1件は「日付 + 会議名」のセルと、DataSubmit2 のリンクが対で現れる
  const pattern =
    /(\d{4})\/(\d{2})\/(\d{2})[\s\S]{0,200}?DataSubmit2\('(v\d{8}_\d+)\.vcsv'/g;

  for (const match of html.matchAll(pattern)) {
    const vcsv = match[4];
    if (seen.has(vcsv)) continue;
    seen.add(vcsv);
    hits.push({
      vcsv,
      date: `${match[1]}-${match[2]}-${match[3]}`,
      meetingName: extractMeetingName(html, vcsv),
    });
  }

  return hits.sort((a, b) => a.date.localeCompare(b.date));
}

/** 該当件数（「69 件の文書」）を読む。取れなければ null。 */
export function parseAmivoiceHitCount(html: string): number | null {
  const text = html.replace(/<[^>]+>/g, " ");
  const matched = text.match(/(\d+)\s*件の文書/);
  return matched ? Number(matched[1]) : null;
}

/**
 * 会議記録IDの周辺から会議名を拾う。取れなければ空文字。
 *
 * 実際のHTMLでは会議名は DataSubmit2 のリンク文言の側にあり、
 * IDより後ろに現れる。前後どちらにも会議名が来うるため、
 * ID の直後を優先しつつ、無ければ手前も見る。
 */
function extractMeetingName(html: string, vcsv: string): string {
  const index = html.indexOf(vcsv);
  if (index === -1) return "";

  const after = toPlainText(html.slice(index, index + 500));
  const before = toPlainText(html.slice(Math.max(0, index - 500), index));

  return firstMeetingName(after) || lastMeetingName(before);
}

function toPlainText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

const MEETING_NAME = /([^\s（(]*(?:委員会|定例会|臨時会|全員協議会))/g;

function firstMeetingName(text: string): string {
  return text.match(MEETING_NAME)?.[0] ?? "";
}

function lastMeetingName(text: string): string {
  const names = text.match(MEETING_NAME);
  return names ? names[names.length - 1] : "";
}
