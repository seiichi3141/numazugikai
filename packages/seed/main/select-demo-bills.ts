export type SeedBill = { id: string; name: string };

/**
 * デモ用インタビューを紐づける議案を、取り込み済みの実在議案から選ぶ。
 *
 * シードは議案を作らないため、対象は取り込み（@mirai-gikai/numazu-ingest）が
 * 入れた実データから選ぶしかない。取り込む会期によって議案の顔ぶれが変わるので、
 * 「この議案が理想」→「この種類の議案なら可」→「あきらめる」の順で候補を落としていく。
 */

/** 基本デモ（賛否を聞くシンプルなインタビュー）の対象候補 */
const DEMO_BILL_EXACT_NAME =
  "工事請負契約の締結（沼津市立金岡小学校校舎等外壁改修他工事）";
const DEMO_BILL_FALLBACK_KEYWORDS = ["工事請負契約の締結", "条例の一部改正"];

/** トピック分析デモ（多様な立場の意見を集める）の対象候補 */
const TOPIC_ANALYSIS_BILL_EXACT_NAME = "令和８年度沼津市一般会計予算";
const TOPIC_ANALYSIS_BILL_FALLBACK_KEYWORDS = ["一般会計予算"];

export type DemoBillSelection = {
  /** 基本デモ用の議案。適当な議案が1件もなければ null */
  demoBill: SeedBill | null;
  /**
   * トピック分析デモ用の議案。会話内容が「市の予算案」を前提にしているため、
   * 予算案が見つからなければ null にしてデモごとスキップする。
   */
  topicAnalysisBill: SeedBill | null;
};

function pick(
  bills: SeedBill[],
  exactName: string,
  fallbackKeywords: string[],
  excludeId?: string
): SeedBill | null {
  const candidates = bills.filter((bill) => bill.id !== excludeId);

  const exact = candidates.find((bill) => bill.name === exactName);
  if (exact) return exact;

  for (const keyword of fallbackKeywords) {
    const matched = candidates.find((bill) => bill.name.includes(keyword));
    if (matched) return matched;
  }

  return null;
}

export function selectDemoBills(bills: SeedBill[]): DemoBillSelection {
  const topicAnalysisBill = pick(
    bills,
    TOPIC_ANALYSIS_BILL_EXACT_NAME,
    TOPIC_ANALYSIS_BILL_FALLBACK_KEYWORDS
  );

  // 予算案は基本デモに回さない（トピック分析デモと同じ議案になると
  // interview_configs の「1議案につき public な設定は1件」制約に引っかかる）
  const demoBill =
    pick(
      bills,
      DEMO_BILL_EXACT_NAME,
      DEMO_BILL_FALLBACK_KEYWORDS,
      topicAnalysisBill?.id
    ) ??
    bills.find((bill) => bill.id !== topicAnalysisBill?.id) ??
    null;

  return { demoBill, topicAnalysisBill };
}
