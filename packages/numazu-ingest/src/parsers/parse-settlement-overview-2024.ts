import { parseJapaneseAmountToYen } from "../shared/utils/parse-fiscal-amount-value";
import {
  buildFiscalAmountRecord,
  type FiscalParserResult,
} from "./fiscal-parser-types";

const FISCAL_YEAR = 2024;

function compact(value: string): string {
  return value.replace(/\s/g, "");
}

export function parseSettlementOverview2024(text: string): FiscalParserResult {
  const pages = text.split("\f");
  const pageIndex = pages.findIndex((page) => {
    const normalized = compact(page);
    return (
      normalized.includes("令和６年度沼津市一般会計等の決算の概要") &&
      normalized.includes("１一般会計")
    );
  });
  if (pageIndex < 0) {
    return {
      records: [],
      validationSummary: [
        {
          ruleCode: "settlement_overview_schema_missing",
          severity: "hard_error",
          message: "令和6年度決算概要の一般会計見出しを検出できませんでした",
        },
      ],
    };
  }

  const page = compact(pages[pageIndex] ?? "");
  const revenueText = page.match(/歳入([^（(]+円)[（(]/)?.[1] ?? null;
  const expenditureText = page.match(/歳出([^（(]+円)[（(]/)?.[1] ?? null;
  const revenueYen = revenueText ? parseJapaneseAmountToYen(revenueText) : null;
  const expenditureYen = expenditureText
    ? parseJapaneseAmountToYen(expenditureText)
    : null;
  if (
    revenueText === null ||
    expenditureText === null ||
    revenueYen === null ||
    expenditureYen === null ||
    revenueYen % 1_000n !== 0n ||
    expenditureYen % 1_000n !== 0n
  ) {
    return {
      records: [],
      validationSummary: [
        {
          ruleCode: "settlement_overview_amounts_invalid",
          severity: "hard_error",
          message: "一般会計の歳入・歳出決算額を千円単位で確定できませんでした",
        },
      ],
    };
  }

  const roundedValidation = {
    ruleCode: "settlement_overview_rounded_to_thousand_yen",
    severity: "info" as const,
    message: "概要資料の表示値は千円未満を丸めた比較用根拠です",
  };
  const amount = (params: {
    measure: "revenue_actual" | "expenditure_actual";
    sourceValueText: string;
    amountYen: bigint;
  }) =>
    buildFiscalAmountRecord({
      fiscalYear: FISCAL_YEAR,
      eventKind: "settlement",
      decisionStage: "not_applicable",
      measure: params.measure,
      amountYen: params.amountYen,
      sourceValueText: params.sourceValueText,
      sourceValueNumeric: (params.amountYen / 1_000n).toString(),
      sourceUnit: "thousand_yen",
      sourcePrecisionYen: 1_000,
      evidenceRole: "corroborating",
      comparisonToleranceYen: 500,
      sourcePage: pageIndex + 1,
      sourceTable: "一般会計 決算概要",
      validationResults: [roundedValidation],
    });

  return {
    records: [
      amount({
        measure: "revenue_actual",
        sourceValueText: revenueText,
        amountYen: revenueYen,
      }),
      amount({
        measure: "expenditure_actual",
        sourceValueText: expenditureText,
        amountYen: expenditureYen,
      }),
    ],
    validationSummary: [
      {
        ruleCode: "settlement_overview_amounts_detected",
        severity: "info",
        message: "一般会計の歳入・歳出決算額を検出しました",
      },
    ],
  };
}
