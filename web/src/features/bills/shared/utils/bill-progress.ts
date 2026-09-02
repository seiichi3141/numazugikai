import type { BillStatusEnum } from "../types";

/**
 * 議案の審議段階。市議会は一院制なので、
 * 「提出 → 委員会付託 → 委員会審査 → 本会議議決」の4段階で表す。
 */
export const BILL_PROGRESS_STEPS = [
  { label: "提出" },
  { label: "委員会付託" },
  { label: "委員会審査" },
  { label: "本会議議決" },
] as const;

// ステップ番号マッピング（0 = まだ始まっていない）
const STATUS_TO_STEP: Record<BillStatusEnum, number> = {
  preparing: 0,
  submitted: 1,
  in_committee: 2,
  continued: 3,
  passed: 4,
  rejected: 4,
  consented: 4,
  approved: 4,
  certified: 4,
  adopted: 4,
  not_adopted: 4,
  withdrawn: 4,
  reported: 4,
};

// プログレス比率（ステップ0〜4に対応）
const PROGRESS_RATIOS = [0, 1 / 8, 3 / 8, 5 / 8, 1] as const;

/** ステータスから現在のステップ番号を求める */
export function getCurrentStep(status: BillStatusEnum): number {
  return STATUS_TO_STEP[status] ?? 0;
}

/**
 * ステータスとステータスノートからメッセージを生成する
 */
export function getStatusMessage(
  status: BillStatusEnum,
  statusNote: string | null | undefined
): string {
  if (status === "preparing") return "議案提出前";
  return statusNote || "";
}

/**
 * ステップ番号と現在のステップからステップの状態を判定する
 */
export function getStepState(
  stepNumber: number,
  currentStep: number,
  isPreparing: boolean
): "active" | "inactive" {
  if (isPreparing) return "inactive";
  return stepNumber <= currentStep ? "active" : "inactive";
}

/**
 * 現在のステップからプログレスバーの幅(%)を計算する
 */
export function calculateProgressWidth(currentStep: number): number {
  const ratio = PROGRESS_RATIOS[currentStep] ?? 0;
  return ratio * 100;
}
