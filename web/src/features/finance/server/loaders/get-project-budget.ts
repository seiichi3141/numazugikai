import "server-only";
import projectBudget2024 from "../../shared/data/project-budget-2024.json";
import type { ProjectBudgetData } from "../../shared/types/project-budget";

/** 試作のため年度ごとの静的データから読む。 */
const PROJECT_BUDGET_BY_YEAR: Record<number, ProjectBudgetData | undefined> = {
  2024: projectBudget2024 as ProjectBudgetData,
};

export function getProjectBudget(fiscalYear: number): ProjectBudgetData | null {
  return PROJECT_BUDGET_BY_YEAR[fiscalYear] ?? null;
}

export function hasProjectBudget(fiscalYear: number): boolean {
  return getProjectBudget(fiscalYear) !== null;
}
