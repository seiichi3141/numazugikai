import type {
  BillCategoryEnum,
  BillStatusEnum,
  BillSubmitterEnum,
  StanceTypeEnum,
} from "@/features/bills/shared/types";

export type OpenDataMiraiStance = {
  /** 賛否の種別（for / against など） */
  type: StanceTypeEnum;
  /** 賛否種別の日本語ラベル（賛成 / 反対 など） */
  label: string;
  /** 賛否についての補足コメント */
  comment: string | null;
};

export type OpenDataBillTag = {
  id: string;
  label: string;
};

export type OpenDataBillItem = {
  billId: string;
  /** 議案の正式名称 */
  name: string;
  /** わかりやすいタイトル（難易度別コンテンツ由来） */
  title: string;
  /** 議案の概要（難易度別コンテンツ由来） */
  summary: string;
  status: BillStatusEnum;
  /** 審議状況の日本語ラベル（委員会で審査中 / 可決 など） */
  statusLabel: string;
  statusNote: string | null;
  /** 議案番号（例: 議第58号）。取り込み前の議案では null */
  billNumber: string | null;
  /** 議案の分類（条例 / 予算 など）。未設定は null */
  category: BillCategoryEnum | null;
  /** 議案分類の日本語ラベル。未設定は null */
  categoryLabel: string | null;
  /** 提出者（市長 / 議員 など）。未設定は null */
  submitter: BillSubmitterEnum | null;
  /** 提出者の日本語ラベル。未設定は null */
  submitterLabel: string | null;
  /** 付託委員会の略称（例: 総務経済）。付託がなければ null */
  committee: string | null;
  submittedDate: string | null;
  /** 本会議での議決日。未議決は null */
  decidedOn: string | null;
  /** 議案本文PDFのURL（沼津市議会サイト）。無い場合は null */
  documentUrl: string | null;
  publishedAt: string | null;
  tags: OpenDataBillTag[];
  /** チームみらいの賛否。未表明の場合は null */
  miraiStance: OpenDataMiraiStance | null;
  createdAt: string;
};

export type OpenDataBillsResult = {
  items: OpenDataBillItem[];
  nextCursor: string | null;
};

export type OpenDataBillDetail = OpenDataBillItem & {
  /** 議案の本文解説（Markdown、難易度別コンテンツ由来） */
  content: string;
};
