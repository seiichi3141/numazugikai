import type { RecipientKind, SpendingRecipient } from "./spending-flow";

/** 予算概要書の1行。金額は資料どおり千円単位。 */
export type ProjectBudgetItem = {
  id: number;
  purpose: string;
  moku: string;
  name: string;
  amountThousandYen: number;
  note: string;
};

/** 主要建設事業の予算と決算。予算は当初予算で、補正と繰越を含まない。 */
export type ProjectConstruction = {
  name: string;
  itemId: number | null;
  budgetThousandYen: number | null;
  settledThousandYen: number;
};

/** 随意契約一覧の1行。`itemId` は名称の一致度による推定。 */
export type ProjectContract = {
  department: string;
  name: string;
  /** 個人の可能性があるか、読み取れない相手方は null。 */
  party: string | null;
  contractedOn: string;
  /** 単価契約など総額の記載がない場合は null。 */
  amountYen: number | null;
  itemId: number | null;
};

export type ProjectBudgetData = {
  fiscalYear: number;
  /** 概要書の13款の合計。人件費なども含む一般会計の当初予算全体。 */
  budgetTotalThousandYen: number;
  items: ProjectBudgetItem[];
  constructions: ProjectConstruction[];
  contracts: ProjectContract[];
  recipientLinks: { kind: RecipientKind; no: number; itemId: number }[];
  sources: { title: string; url: string }[];
};

/** 画面に出す1事業。関連する決算・補助金・契約をまとめたもの。 */
export type ProjectRow = ProjectBudgetItem & {
  settledThousandYen: number | null;
  recipients: SpendingRecipient[];
  contracts: ProjectContract[];
};

export type ProjectCoverage = {
  itemCount: number;
  budgetThousandYen: number;
  constructionCount: number;
  settledThousandYen: number;
  recipientCount: number;
  linkedRecipientCount: number;
  recipientThousandYen: number;
  linkedRecipientThousandYen: number;
  contractCount: number;
  linkedContractCount: number;
  contractYen: number;
  linkedContractYen: number;
};
