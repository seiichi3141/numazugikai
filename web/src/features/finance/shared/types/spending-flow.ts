export type RecipientKind = "subsidy" | "burden" | "grant";

/** 補助金・負担金・交付金の一覧の1行。金額は資料どおり千円単位。 */
export type SpendingRecipient = {
  kind: RecipientKind;
  no: number;
  department: string | null;
  division: string | null;
  category: string | null;
  name: string;
  recipient: string | null;
  amountThousandYen: number;
};

export type SpendingFlowData = {
  fiscalYear: number;
  purposeNames: string[];
  revenue: { code: number; name: string; amountThousandYen: number }[];
  /** 節ごとの款別決算額。`amounts` は `purposeNames` と同じ順に並ぶ。 */
  expenditureRows: { name: string; amounts: number[] }[];
  kindTotals: Record<
    RecipientKind,
    { amountThousandYen: number; count: number }
  >;
  recipients: SpendingRecipient[];
  sources: { title: string; url: string }[];
};

export type SankeyColumn = "revenue" | "account" | "purpose" | "expense";

export type SankeyNode = {
  id: string;
  label: string;
  column: SankeyColumn;
  valueThousandYen: number;
};

export type SankeyLink = {
  source: string;
  target: string;
  valueThousandYen: number;
};
