export type GeneralQuestionCurrentTermSource = {
  fileName: string;
  sessionNumber: number;
  questionKind: "representative" | "personal";
  expectedAppearanceCount: number;
  expectedTopLevelItemCount: number;
};

/**
 * 第25期ページで2026-09-04時点に公開済みの一般質問資料。
 * 臨時会には一般質問PDFがないため、定例会の14ファイルを対象にする。
 */
export const GENERAL_QUESTION_CURRENT_TERM_SOURCES = [
  ["ippan-0506.pdf", 1, "personal", 14, 35],
  ["ippan-0509.pdf", 2, "personal", 12, 27],
  ["ippan-0511.pdf", 3, "personal", 14, 29],
  ["ippan-d-0602.pdf", 4, "representative", 7, 29],
  ["ippan-k-0602.pdf", 4, "personal", 6, 12],
  ["ippan-0606.pdf", 5, "personal", 17, 32],
  ["ippan-0609.pdf", 6, "personal", 15, 27],
  ["ippan-0611.pdf", 7, "personal", 16, 33],
  ["ippan-0702.pdf", 8, "representative", 18, 48],
  ["ippan-0706.pdf", 9, "personal", 12, 26],
  ["ippan-0709.pdf", 10, "personal", 16, 32],
  ["ippan-0711.pdf", 11, "personal", 14, 22],
  ["ippan-0802.pdf", 12, "representative", 13, 19],
  ["ippan-0806.pdf", 13, "personal", 15, 34],
] as const satisfies readonly (readonly [
  string,
  number,
  GeneralQuestionCurrentTermSource["questionKind"],
  number,
  number,
])[];

export function getGeneralQuestionCurrentTermSources(): GeneralQuestionCurrentTermSource[] {
  return GENERAL_QUESTION_CURRENT_TERM_SOURCES.map(
    ([
      fileName,
      sessionNumber,
      questionKind,
      expectedAppearanceCount,
      expectedTopLevelItemCount,
    ]) => ({
      fileName,
      sessionNumber,
      questionKind,
      expectedAppearanceCount,
      expectedTopLevelItemCount,
    })
  );
}
