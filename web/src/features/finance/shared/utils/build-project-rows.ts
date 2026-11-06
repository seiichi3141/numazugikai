import type {
  ProjectBudgetData,
  ProjectCoverage,
  ProjectRow,
} from "../types/project-budget";
import type { SpendingRecipient } from "../types/spending-flow";
import { normalizeQuery } from "./filter-spending-recipients";

function recipientKey(kind: string, no: number): string {
  return `${kind}-${no}`;
}

function sumBy<T>(rows: readonly T[], amount: (row: T) => number): number {
  return rows.reduce((total, row) => total + amount(row), 0);
}

/** 予算の事業に、主要建設事業の決算と、紐づいた補助金・契約を集める。 */
export function buildProjectRows(
  data: ProjectBudgetData,
  recipients: readonly SpendingRecipient[]
): ProjectRow[] {
  const rows = new Map<number, ProjectRow>(
    data.items.map((item) => [
      item.id,
      { ...item, settledThousandYen: null, recipients: [], contracts: [] },
    ])
  );
  const recipientsByKey = new Map(
    recipients.map((row) => [recipientKey(row.kind, row.no), row])
  );

  for (const construction of data.constructions) {
    const row =
      construction.itemId === null ? null : rows.get(construction.itemId);
    if (row) row.settledThousandYen = construction.settledThousandYen;
  }
  for (const link of data.recipientLinks) {
    const recipient = recipientsByKey.get(recipientKey(link.kind, link.no));
    if (recipient) rows.get(link.itemId)?.recipients.push(recipient);
  }
  for (const contract of data.contracts) {
    if (contract.itemId !== null) {
      rows.get(contract.itemId)?.contracts.push(contract);
    }
  }
  return [...rows.values()];
}

/** 資料全体のうち、どこまで事業と結び付いたかを集計する。 */
export function summarizeProjectCoverage(
  data: ProjectBudgetData,
  recipients: readonly SpendingRecipient[]
): ProjectCoverage {
  const linkedKeys = new Set(
    data.recipientLinks.map((link) => recipientKey(link.kind, link.no))
  );
  const linkedRecipients = recipients.filter((row) =>
    linkedKeys.has(recipientKey(row.kind, row.no))
  );
  const linkedContracts = data.contracts.filter((row) => row.itemId !== null);
  const contractAmount = (row: { amountYen: number | null }) =>
    row.amountYen ?? 0;
  const recipientAmount = (row: SpendingRecipient) => row.amountThousandYen;

  return {
    itemCount: data.items.length,
    budgetThousandYen: sumBy(data.items, (row) => row.amountThousandYen),
    constructionCount: data.constructions.length,
    settledThousandYen: sumBy(
      data.constructions,
      (row) => row.settledThousandYen
    ),
    recipientCount: recipients.length,
    linkedRecipientCount: linkedRecipients.length,
    recipientThousandYen: sumBy(recipients, recipientAmount),
    linkedRecipientThousandYen: sumBy(linkedRecipients, recipientAmount),
    contractCount: data.contracts.length,
    linkedContractCount: linkedContracts.length,
    contractYen: sumBy(data.contracts, contractAmount),
    linkedContractYen: sumBy(linkedContracts, contractAmount),
  };
}

export type ProjectFilter = {
  purpose: string;
  query: string;
  linkedOnly: boolean;
};

export const ALL_PURPOSES = "all";

function matchesQuery(row: ProjectRow, query: string): boolean {
  const names = [
    row.name,
    row.note,
    row.moku,
    ...row.recipients.flatMap((item) => [item.name, item.recipient]),
    ...row.contracts.flatMap((item) => [item.name, item.party]),
  ];
  return names.some((value) => value && normalizeQuery(value).includes(query));
}

/** 款・キーワード・実績の有無で絞り込み、予算額の大きい順に並べる。 */
export function filterProjectRows(
  rows: readonly ProjectRow[],
  filter: ProjectFilter
): ProjectRow[] {
  const query = normalizeQuery(filter.query);
  return rows
    .filter(
      (row) => filter.purpose === ALL_PURPOSES || row.purpose === filter.purpose
    )
    .filter(
      (row) =>
        !filter.linkedOnly ||
        row.settledThousandYen !== null ||
        row.recipients.length > 0 ||
        row.contracts.length > 0
    )
    .filter((row) => query === "" || matchesQuery(row, query))
    .sort((a, b) => b.amountThousandYen - a.amountThousandYen);
}
