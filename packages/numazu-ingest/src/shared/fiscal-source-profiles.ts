export type FiscalSourceKind =
  | "budget_overview"
  | "execution_report"
  | "settlement_report"
  | "major_measures"
  | "fiscal_comparison"
  | "public_accounting";

export type FiscalSourceProfile = {
  profileKey: string;
  profileVersion: string;
  parserName: string;
  parserVersion: string;
  sourceKind: FiscalSourceKind;
  seriesCode: string;
  fiscalYear: number;
  title: string;
  url: string;
  expectedMediaType: "application/pdf";
};

const PROFILE_VERSION = "1.0.0";
const PARSER_NAME = "numazu-fiscal-document-metadata";
const PARSER_VERSION = "1.0.0";

export const fiscalSourceProfiles = [
  {
    profileKey: "budget-overview-2026-general-account",
    profileVersion: PROFILE_VERSION,
    parserName: PARSER_NAME,
    parserVersion: PARSER_VERSION,
    sourceKind: "budget_overview",
    seriesCode: "budget-overview-general-account",
    fiscalYear: 2026,
    title: "令和8年度 一般会計",
    url: "https://www.city.numazu.shizuoka.jp/shisei/gyozaisei/finance/yosan2026/gaiyousho/pdf/s-1.pdf",
    expectedMediaType: "application/pdf",
  },
  {
    profileKey: "budget-overview-2026-council-expense",
    profileVersion: PROFILE_VERSION,
    parserName: PARSER_NAME,
    parserVersion: PARSER_VERSION,
    sourceKind: "budget_overview",
    seriesCode: "budget-overview-council-expense",
    fiscalYear: 2026,
    title: "令和8年度 議会費",
    url: "https://www.city.numazu.shizuoka.jp/shisei/gyozaisei/finance/yosan2026/gaiyousho/pdf/i-1.pdf",
    expectedMediaType: "application/pdf",
  },
  {
    profileKey: "settlement-overview-2024",
    profileVersion: PROFILE_VERSION,
    parserName: PARSER_NAME,
    parserVersion: PARSER_VERSION,
    sourceKind: "settlement_report",
    seriesCode: "settlement-overview",
    fiscalYear: 2024,
    title: "令和6年度 決算の概要",
    url: "https://www.city.numazu.shizuoka.jp/shisei/gyozaisei/finance/kessan2024/pdf/gaiyou.pdf",
    expectedMediaType: "application/pdf",
  },
  {
    profileKey: "major-measures-2024-fiscal",
    profileVersion: PROFILE_VERSION,
    parserName: PARSER_NAME,
    parserVersion: PARSER_VERSION,
    sourceKind: "major_measures",
    seriesCode: "major-measures-fiscal",
    fiscalYear: 2024,
    title: "令和6年度 主要な施策の成果等報告書 第1章 財政",
    url: "https://www.city.numazu.shizuoka.jp/shisei/gyozaisei/finance/kessan2024/pdf_houkoku/1.pdf",
    expectedMediaType: "application/pdf",
  },
] as const satisfies readonly FiscalSourceProfile[];

export function findFiscalSourceProfile(
  profileKey: string
): FiscalSourceProfile | null {
  return (
    fiscalSourceProfiles.find((profile) => profile.profileKey === profileKey) ??
    null
  );
}
