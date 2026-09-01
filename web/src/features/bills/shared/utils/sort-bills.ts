export const BILL_SORT_KEYS = [
  "voices",
  "new",
  "updated",
  "old",
  "status",
] as const;

export type BillSortKey = (typeof BILL_SORT_KEYS)[number];

export const BILL_SORT_LABELS: Record<BillSortKey, string> = {
  voices: "声が集まっている順",
  new: "提出日が新しい順",
  updated: "更新が新しい順",
  old: "提出日が古い順",
  status: "審議状況順",
};

export const DEFAULT_BILL_SORT: BillSortKey = "new";

/** 文字列を並び順に絞り込む型ガード。URL 直打ちで壊れないようにする。 */
export function isBillSortKey(value: unknown): value is BillSortKey {
  return (
    typeof value === "string" &&
    (BILL_SORT_KEYS as readonly string[]).includes(value)
  );
}
