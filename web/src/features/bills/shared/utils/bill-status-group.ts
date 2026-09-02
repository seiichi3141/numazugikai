import type { BillStatusEnum } from "../types";

/**
 * 議案一覧のステータス絞り込みで使うグループ。
 *
 * DB の status は市議会の議決の種類まで持つ（可決・同意・承認・認定・採択…）が、
 * 一覧のタブはデザイン上4つに束ねる。議決の種類は絞り込みの軸としては
 * 細かすぎるため、まとめて「可決」にする。
 */
export const BILL_STATUS_GROUPS = [
  "all",
  "deliberating",
  "waiting",
  "enacted",
  "rejected",
] as const;

export type BillStatusGroup = (typeof BILL_STATUS_GROUPS)[number];

export const BILL_STATUS_GROUP_LABELS: Record<BillStatusGroup, string> = {
  all: "すべて",
  deliberating: "審議中",
  waiting: "その他",
  enacted: "可決",
  rejected: "否決",
};

/**
 * status をタブのグループに畳む。
 *
 * 既存の `getCardStatusLabel` と同じ畳み方にする。カードに「審議中」と
 * 出ている議案が「審議中」タブに現れない、という食い違いを作らない。
 *
 * 「その他」に残るのは提出前（preparing）と、議決を伴わない撤回・報告。
 */
export function toBillStatusGroup(
  status: BillStatusEnum
): Exclude<BillStatusGroup, "all"> {
  switch (status) {
    case "submitted":
    case "in_committee":
    case "continued":
      return "deliberating";
    case "passed":
    case "consented":
    case "approved":
    case "certified":
    case "adopted":
      return "enacted";
    case "rejected":
    case "not_adopted":
      return "rejected";
    default:
      return "waiting";
  }
}

/** 文字列をグループに絞り込む型ガード。URL 直打ちで壊れないようにする。 */
export function isBillStatusGroup(value: unknown): value is BillStatusGroup {
  return (
    typeof value === "string" &&
    (BILL_STATUS_GROUPS as readonly string[]).includes(value)
  );
}

/** グループごとの件数。呼び出し側が渡した母集合をそのまま数える。 */
export function countByStatusGroup(
  bills: readonly { status: BillStatusEnum }[]
): Record<BillStatusGroup, number> {
  const counts: Record<BillStatusGroup, number> = {
    all: bills.length,
    deliberating: 0,
    waiting: 0,
    enacted: 0,
    rejected: 0,
  };
  for (const bill of bills) {
    counts[toBillStatusGroup(bill.status)] += 1;
  }
  return counts;
}

/** グループで絞る。`all` は素通し。 */
export function filterByStatusGroup<T extends { status: BillStatusEnum }>(
  bills: readonly T[],
  group: BillStatusGroup
): T[] {
  if (group === "all") return [...bills];
  return bills.filter((bill) => toBillStatusGroup(bill.status) === group);
}
