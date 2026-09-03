import type {
  CouncilBillCategory,
  CouncilDecision,
  CouncilSubmitterKind,
} from "@mirai-gikai/council-ingest-core/types";

/** 沼津市議会の議案取り込みで扱う型 */

/** 議案番号の接頭辞の種別 */
export type BillNumberKind =
  | "gi" // 議第◯号（市長・議員提出の議案）
  | "hou" // 報第◯号（報告）
  | "nin" // 認第◯号（人事同意・専決承認）
  | "hatsugi" // 発議第◯号（議員・委員会提出の発議）
  | "seigan" // 請願第◯号
  | "chinjo"; // 陳情第◯号

/** 議案の分類（地方自治法の根拠区分に対応） */
export type BillCategory = Extract<
  CouncilBillCategory,
  | "ordinance"
  | "budget"
  | "settlement"
  | "contract"
  | "provisional_approval"
  | "report"
  | "personnel"
  | "opinion_paper"
  | "petition"
  | "other"
>;

/** 議案の提出者 */
export type BillSubmitter = Extract<
  CouncilSubmitterKind,
  "mayor" | "member" | "committee" | "citizen"
>;

/** 本会議での議決結果 */
export type BillDecision = Extract<
  CouncilDecision,
  | "passed"
  | "rejected"
  | "consented"
  | "approved"
  | "certified"
  | "adopted"
  | "not_adopted"
  | "continued"
  | "withdrawn"
  | "reported"
>;

/** 議案審議結果PDFから抽出した1件の議案 */
export type ParsedBill = {
  /** 表記どおりの議案番号（例: "議第58号"） */
  billNumber: string;
  numberKind: BillNumberKind;
  /** 議案番号の数値部分（例: 58） */
  numberValue: number;
  title: string;
  category: BillCategory;
  /** 根拠条項（例: "地方自治法第96条第1項第1号"）。記載がなければ null */
  legalBasis: string | null;
  /** ISO 8601 の日付（例: "2026-06-05"）。読み取れなければ null */
  submittedOn: string | null;
  submitter: BillSubmitter | null;
  /** 付託先委員会（例: "民生病院教育"）。付託省略は "省略" */
  committee: string | null;
  /** 委員会審査結果（例: "可決すべきもの"）。該当なしは null */
  committeeResult: string | null;
  decidedOn: string | null;
  decision: BillDecision | null;
};

/** 議案審議結果PDF 1本分の解析結果 */
export type ParsedGianResult = {
  /** 定例会の回次（例: 13）。読み取れなければ null */
  sessionNumber: number | null;
  /** 見出しそのまま（例: "第13回（令和８年６月）定例会"） */
  sessionLabel: string | null;
  /** 元号（例: "令和"）。日付の西暦変換に使う */
  era: string | null;
  /** 見出しの元号年を西暦に直したもの（例: 2026）。読み取れなければ null */
  year: number | null;
  /** 見出しの開催月（例: 6）。読み取れなければ null */
  month: number | null;
  bills: ParsedBill[];
};
