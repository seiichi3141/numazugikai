/** 沼津市議会サイトの入口URL。ページ構成が変わったらここだけ直す。 */
export const NUMAZU_GIKAI_BASE =
  "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki";

export const NUMAZU_SITE_URLS = {
  /** 定例会会期予定 */
  sessionSchedule: `${NUMAZU_GIKAI_BASE}/annai/yotei.htm`,
  /** 本会議の報告（期ごとの索引） */
  reportIndex: `${NUMAZU_GIKAI_BASE}/annai/houkoku/index.htm`,
  /** 本会議のお知らせ（開会中の定例会の議案本文PDF一覧） */
  billDocuments: `${NUMAZU_GIKAI_BASE}/annai/oshirase.htm`,
  /** 議会だより索引 */
  dayoriIndex: `${NUMAZU_GIKAI_BASE}/dayori/index.htm`,
} as const;

/**
 * 議案審議結果PDFのURLを組み立てる。
 *
 * 例: 第25期・令和8年6月 -> .../houkoku/teirei_25_pdf/gian-0806.pdf
 *
 * @param term 議員の期（例: 25）
 * @param eraYear 元号年（例: 8）
 * @param month 開催月（例: 6）
 */
export function buildGianResultPdfUrl(
  term: number,
  eraYear: number,
  month: number
): string {
  const yy = String(eraYear).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${NUMAZU_GIKAI_BASE}/annai/houkoku/teirei_${term}_pdf/gian-${yy}${mm}.pdf`;
}

/** 期ごとの本会議報告ページ（例: .../houkoku/teirei_25.htm） */
export function buildReportTermUrl(term: number): string {
  return `${NUMAZU_GIKAI_BASE}/annai/houkoku/teirei_${term}.htm`;
}

/** 現在の期。任期満了（2027年4月）で 26 に上げる。 */
export const CURRENT_TERM = 25;
