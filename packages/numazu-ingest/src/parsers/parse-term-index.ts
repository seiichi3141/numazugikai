/** 期のページから見つけた議案審議結果PDF 1件 */
export type TermGianPdf = {
  /** ページ内の相対パス（例: teirei_25_pdf/gian-0806.pdf） */
  path: string;
  /** ファイル名の元号年（例: 8） */
  eraYear: number;
  /** ファイル名の月（例: 6） */
  month: number;
};

/**
 * 期の本会議報告ページ（teirei_NN.htm）から、議案審議結果PDFを見つける。
 *
 * ファイル名は `gian-{元号年2桁}{月2桁}.pdf` で、元号の区別が入っていない。
 * 平成16年6月も令和8年6月も同じ `gian-1606.pdf` / `gian-0806.pdf` の形式で、
 * どちらの元号かは期（teirei_NN）とファイルの中身の見出しでしか分からない。
 * そのため元号の判定はPDF本文の見出しに委ね、ここでは在処だけを返す。
 */
export function parseTermIndex(html: string, term: number): TermGianPdf[] {
  const pattern = new RegExp(
    `teirei_${term}_pdf/(gian-(\\d{2})(\\d{2})\\.pdf)`,
    "g"
  );

  const found = new Map<string, TermGianPdf>();
  for (const match of html.matchAll(pattern)) {
    const path = `teirei_${term}_pdf/${match[1]}`;
    if (found.has(path)) continue;
    found.set(path, {
      path,
      eraYear: Number(match[2]),
      month: Number(match[3]),
    });
  }

  // 会期の順に並べる。元号跨ぎは期の中では起きないため元号年で単純に並べてよい
  return [...found.values()].sort(
    (a, b) => a.eraYear - b.eraYear || a.month - b.month
  );
}

/** 沼津市議会の議員の期。第20期（平成15年〜）以降が公開されている。 */
export const OLDEST_TERM = 20;
export const NEWEST_TERM = 25;

/** 公開されているすべての期 */
export function allTerms(): number[] {
  return Array.from(
    { length: NEWEST_TERM - OLDEST_TERM + 1 },
    (_, i) => OLDEST_TERM + i
  );
}
