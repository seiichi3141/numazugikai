import { BILL_STATUS_GROUPS, type BillStatusGroup } from "./bill-status-group";

/** DB が返すファセットの1行。 */
export type FacetRow = {
  kind: string;
  key: string | null;
  count: number;
};

export type BillsListFacets = {
  status: Record<BillStatusGroup, number>;
  /** タグ id ごとの件数。「すべて」は TAG_ALL キーに入る。 */
  tag: Map<string, number>;
};

/** タグを絞り込まないときの件数のキー。タグ id は uuid なので衝突しない。 */
export const TAG_ALL = "all";

/**
 * ファセットの行をチップが読む形に畳む。
 *
 * DB は0件のグループを行として返さない。返らなかったグループを
 * そのまま undefined にすると、チップの件数が空欄で描画される。
 * ここで全グループを0で埋めてから渡す。
 */
export function toBillsListFacets(rows: readonly FacetRow[]): BillsListFacets {
  const status = Object.fromEntries(
    BILL_STATUS_GROUPS.map((group) => [group, 0])
  ) as Record<BillStatusGroup, number>;
  const tag = new Map<string, number>();

  for (const row of rows) {
    if (row.key === null) continue;
    if (row.kind === "status") {
      if (isStatusGroup(row.key)) status[row.key] = row.count;
    } else if (row.kind === "tag") {
      tag.set(row.key, row.count);
    }
  }

  return { status, tag };
}

function isStatusGroup(value: string): value is BillStatusGroup {
  return (BILL_STATUS_GROUPS as readonly string[]).includes(value);
}
