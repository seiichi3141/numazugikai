import type { BillCategory, BillDecision, BillSubmitter } from "./types";

/**
 * 議案審議結果PDFのセクション見出し（"●条例 （地方自治法第96条第1項第1号）"）と
 * 議案分類の対応。見出し名の前方一致で判定するため、長いものを先に置く。
 */
export const SECTION_CATEGORIES: ReadonlyArray<
  readonly [string, BillCategory]
> = [
  ["専決承認", "provisional_approval"],
  ["契約ほか", "contract"],
  ["契約", "contract"],
  ["条例", "ordinance"],
  ["予算", "budget"],
  ["決算", "settlement"],
  ["報告", "report"],
  ["人事", "personnel"],
  ["発議", "opinion_paper"],
  ["意見書", "opinion_paper"],
  ["決議", "opinion_paper"],
  ["請願", "petition"],
  ["陳情", "petition"],
  ["財産", "contract"],
  ["その他", "other"],
];

/** 提出者の表記と種別の対応 */
export const SUBMITTERS: ReadonlyArray<readonly [string, BillSubmitter]> = [
  ["市長", "mayor"],
  ["議員", "member"],
  ["委員会", "committee"],
  ["市民", "citizen"],
];

/**
 * 本会議の審議結果の表記と種別の対応。
 * "不採択" を "採択" より先に置く（前者が後者に食われないように）。
 */
export const DECISIONS: ReadonlyArray<readonly [string, BillDecision]> = [
  ["不採択", "not_adopted"],
  ["継続審査", "continued"],
  ["継続", "continued"],
  ["可決", "passed"],
  ["否決", "rejected"],
  ["同意", "consented"],
  ["承認", "approved"],
  ["認定", "certified"],
  ["採択", "adopted"],
  ["撤回", "withdrawn"],
  ["報告", "reported"],
];

/** 委員会審査結果とみなす表記（"可決すべきもの" など）。"-" は付託省略で審査なし。 */
export const COMMITTEE_RESULT_PATTERN = /すべきもの$/;

/** 付託を省略した場合に委員会欄へ入る表記 */
export const COMMITTEE_OMITTED = "省略";
