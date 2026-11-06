import "server-only";
import spendingFlow2024 from "../../shared/data/spending-flow-2024.json";
import type { SpendingFlowData } from "../../shared/types/spending-flow";

/** 試作のため年度ごとの静的データから読む。 */
const SPENDING_FLOW_BY_YEAR: Record<number, SpendingFlowData | undefined> = {
  2024: spendingFlow2024 as SpendingFlowData,
};

export function getSpendingFlow(fiscalYear: number): SpendingFlowData | null {
  return SPENDING_FLOW_BY_YEAR[fiscalYear] ?? null;
}

export function hasSpendingFlow(fiscalYear: number): boolean {
  return getSpendingFlow(fiscalYear) !== null;
}
