/** 沼津市議会の議案取り込みで扱う共通型 */

/** 議案番号の接頭辞の種別 */
export type BillNumberKind =
  | "gi" // 議第◯号（市長・議員提出の議案）
  | "hou" // 報第◯号（報告）
  | "nin" // 認第◯号（人事同意・専決承認）
  | "hatsugi" // 発議第◯号（議員提出の発議）
  | "seigan" // 請願第◯号
  | "chinjo"; // 陳情第◯号

/** 議案の分類（地方自治法の根拠区分に対応） */
export type BillCategory =
  | "ordinance" // 条例（法96条1項1号）
  | "budget" // 予算（2号）
  | "settlement" // 決算（3号）
  | "contract" // 契約ほか（4〜14号）
  | "provisional_approval" // 専決承認（法179条関係）
  | "report" // 報告（法180条関係ほか）
  | "personnel" // 人事
  | "opinion_paper" // 意見書・決議（発議）
  | "petition" // 請願・陳情
  | "other"; // その他

/** 議案の提出者 */
export type BillSubmitter =
  | "mayor" // 市長
  | "member" // 議員
  | "committee" // 委員会
  | "citizen"; // 市民（請願・陳情）

/** 本会議での議決結果 */
export type BillDecision =
  | "passed" // 可決
  | "rejected" // 否決
  | "consented" // 同意（人事案件）
  | "approved" // 承認（専決処分の承認）
  | "certified" // 認定（決算）
  | "adopted" // 採択（請願・陳情）
  | "not_adopted" // 不採択
  | "continued" // 継続審査
  | "withdrawn" // 撤回
  | "reported"; // 報告済

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
