import type { BillStatusEnum } from "../types";

/**
 * カード用の簡略化されたステータスラベル。
 *
 * 一覧では細かい議決の種類（同意・承認・認定…）まで出すと読みづらいので、
 * 「審査中 / 可決 / 否決 / 提出前」の4つに寄せる。
 */
export function getCardStatusLabel(status: BillStatusEnum): string {
  switch (status) {
    case "submitted":
    case "in_committee":
    case "continued":
      return "審議中";
    case "passed":
    case "consented":
    case "approved":
    case "certified":
    case "adopted":
      return "可決";
    case "rejected":
    case "not_adopted":
      return "否決";
    case "withdrawn":
      return "撤回";
    case "reported":
      return "報告";
    default:
      return "提出前";
  }
}

/** ステータスに対応するBadgeのvariantを取得 */
export function getStatusVariant(
  status: BillStatusEnum
): "light" | "default" | "dark" | "muted" {
  switch (status) {
    case "submitted":
    case "in_committee":
    case "continued":
      return "light";
    case "passed":
    case "consented":
    case "approved":
    case "certified":
    case "adopted":
      return "default";
    case "rejected":
    case "not_adopted":
      return "dark";
    default:
      return "muted";
  }
}
