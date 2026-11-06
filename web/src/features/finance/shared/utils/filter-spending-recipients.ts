import type { RecipientKind, SpendingRecipient } from "../types/spending-flow";

export type RecipientKindFilter = RecipientKind | "all";

function normalizeQuery(text: string): string {
  return text.normalize("NFKC").toLowerCase().trim();
}

function matchesQuery(row: SpendingRecipient, query: string): boolean {
  return [row.name, row.recipient, row.department, row.division].some((value) =>
    value?.toLowerCase().includes(query)
  );
}

/** 種類とキーワードで絞り込み、金額の大きい順に並べる。 */
export function filterSpendingRecipients(
  rows: readonly SpendingRecipient[],
  kind: RecipientKindFilter,
  query: string
): SpendingRecipient[] {
  const normalizedQuery = normalizeQuery(query);
  return rows
    .filter((row) => kind === "all" || row.kind === kind)
    .filter(
      (row) => normalizedQuery === "" || matchesQuery(row, normalizedQuery)
    )
    .sort((a, b) => b.amountThousandYen - a.amountThousandYen);
}
