import {
  calculateRoundedPercent,
  convertFiscalAmountToYen,
  parseFiscalInteger,
} from "../shared/utils/parse-fiscal-amount-value";
import {
  buildFiscalAmountRecord,
  type FiscalParserResult,
} from "./fiscal-parser-types";

const FISCAL_YEAR = 2024;

function compact(value: string): string {
  return value.replace(/\s/g, "");
}

function numericCells(line: string): string[] {
  return line.match(/[△▲-]?\d[\d,]*(?:\.\d+)?/g) ?? [];
}

function parseYenCell(value: string | undefined): bigint | null {
  return value === undefined ? null : parseFiscalInteger(value);
}

type RelevantPages = {
  budgetPageIndex: number;
  expenditurePageIndex: number;
};

type ExpenditureTable = {
  councilCells: string[];
  totalCells: string[];
  generalInitial: bigint;
  generalCurrent: bigint;
  generalActual: bigint;
  councilInitial: bigint;
  councilCurrent: bigint;
  councilActual: bigint;
};

function findRelevantPages(pages: string[]): RelevantPages | null {
  const budgetPageIndex = pages.findIndex((page) => {
    const normalized = compact(page);
    return (
      normalized.includes("一般会計の当初予算規模") &&
      normalized.includes("最終予算額")
    );
  });
  const expenditurePageIndex = pages.findIndex((page) => {
    const normalized = compact(page);
    return (
      normalized.includes("当初予算額予算現額決算額") &&
      normalized.includes("１議会費") &&
      normalized.includes("執行率")
    );
  });
  return budgetPageIndex >= 0 && expenditurePageIndex >= 0
    ? { budgetPageIndex, expenditurePageIndex }
    : null;
}

function parseBudgetControlTotals(page: string): {
  initial: bigint | null;
  current: bigint | null;
} {
  const normalized = compact(page);
  const initialSource = normalized.match(
    /一般会計の当初予算規模は([\d,]+)千円/
  )?.[1];
  const currentSource = normalized.match(/最終予算額は([\d,]+)千円/)?.[1];
  return {
    initial: initialSource
      ? convertFiscalAmountToYen(initialSource, "thousand_yen")
      : null,
    current: currentSource
      ? convertFiscalAmountToYen(currentSource, "thousand_yen")
      : null,
  };
}

function parseExpenditureTable(
  page: string
):
  | { status: "columns_changed" }
  | { status: "amount_invalid" }
  | { status: "parsed"; table: ExpenditureTable } {
  const lines = page.split("\n");
  const councilLine = lines.find((line) =>
    compact(line).startsWith("１議会費")
  );
  const totalLine = lines.find((line) => compact(line).startsWith("計"));
  const councilCells = councilLine ? numericCells(councilLine) : [];
  const totalCells = totalLine ? numericCells(totalLine) : [];
  if (councilCells.length !== 7 || totalCells.length !== 7) {
    return { status: "columns_changed" };
  }

  const amounts = [
    parseYenCell(totalCells[0]),
    parseYenCell(totalCells[2]),
    parseYenCell(totalCells[4]),
    parseYenCell(councilCells[0]),
    parseYenCell(councilCells[2]),
    parseYenCell(councilCells[4]),
  ];
  if (amounts.some((amount) => amount === null)) {
    return { status: "amount_invalid" };
  }
  const [
    generalInitial,
    generalCurrent,
    generalActual,
    councilInitial,
    councilCurrent,
    councilActual,
  ] = amounts as bigint[];
  return {
    status: "parsed",
    table: {
      councilCells,
      totalCells,
      generalInitial,
      generalCurrent,
      generalActual,
      councilInitial,
      councilCurrent,
      councilActual,
    },
  };
}

export function parseMajorMeasures2024(text: string): FiscalParserResult {
  const pages = text.split("\f");
  const normalizedText = compact(text);
  if (
    !normalizedText.includes("令和６年度") ||
    !normalizedText.includes("第１章財政")
  ) {
    return {
      records: [],
      validationSummary: [
        {
          ruleCode: "major_measures_document_identity_mismatch",
          severity: "hard_error",
          message: "令和6年度市政報告書の第1章財政を確認できませんでした",
        },
      ],
    };
  }

  const relevantPages = findRelevantPages(pages);
  if (!relevantPages) {
    return {
      records: [],
      validationSummary: [
        {
          ruleCode: "major_measures_table_schema_missing",
          severity: "hard_error",
          message:
            "一般会計予算推移または歳出決算表の列構造を検出できませんでした",
        },
      ],
    };
  }

  const controlTotals = parseBudgetControlTotals(
    pages[relevantPages.budgetPageIndex] ?? ""
  );
  const parsedTable = parseExpenditureTable(
    pages[relevantPages.expenditurePageIndex] ?? ""
  );
  if (parsedTable.status === "columns_changed") {
    return {
      records: [],
      validationSummary: [
        {
          ruleCode: "major_measures_expenditure_columns_changed",
          severity: "hard_error",
          message: "一般会計歳出表の列数が想定と一致しませんでした",
        },
      ],
    };
  }

  if (parsedTable.status === "amount_invalid") {
    return {
      records: [],
      validationSummary: [
        {
          ruleCode: "major_measures_amount_invalid",
          severity: "hard_error",
          message: "一般会計または議会費の金額セルを整数化できませんでした",
        },
      ],
    };
  }
  const {
    councilCells,
    totalCells,
    generalInitial,
    generalCurrent,
    generalActual,
    councilInitial,
    councilCurrent,
    councilActual,
  } = parsedTable.table;

  const validationSummary: FiscalParserResult["validationSummary"] = [];
  if (
    controlTotals.initial !== generalInitial ||
    controlTotals.current !== generalCurrent
  ) {
    validationSummary.push({
      ruleCode: "major_measures_budget_control_total_mismatch",
      severity: "hard_error",
      message: "予算推移の本文と歳出表の一般会計合計が一致しません",
    });
  }
  const generalRate = calculateRoundedPercent(generalActual, generalCurrent, 1);
  const councilRate = calculateRoundedPercent(councilActual, councilCurrent, 1);
  const rateChecks = [
    {
      classificationKey: "total",
      label: "一般会計合計",
      publishedMetricValue: totalCells[6],
      calculatedMetricValue: generalRate,
    },
    {
      classificationKey: "council_expense",
      label: "議会費",
      publishedMetricValue: councilCells[6],
      calculatedMetricValue: councilRate,
    },
  ];
  for (const rate of rateChecks) {
    if (rate.calculatedMetricValue === rate.publishedMetricValue) {
      validationSummary.push({
        ruleCode: "major_measures_execution_rate_matched",
        severity: "info",
        message: `${rate.label}の公表執行率と再計算値が一致しました`,
        publishedMetricValue: rate.publishedMetricValue,
        calculatedMetricValue: rate.calculatedMetricValue ?? "",
        classificationKey: rate.classificationKey,
      });
      continue;
    }
    validationSummary.push({
      ruleCode: "major_measures_execution_rate_mismatch",
      severity: "hard_error",
      message: `${rate.label}の決算額と予算現額から算出した執行率が公表値と一致しません`,
      publishedMetricValue: rate.publishedMetricValue,
      calculatedMetricValue: rate.calculatedMetricValue ?? "",
      classificationKey: rate.classificationKey,
    });
  }
  if (
    !validationSummary.some(
      (validation) => validation.severity === "hard_error"
    )
  ) {
    validationSummary.push({
      ruleCode: "major_measures_control_totals_passed",
      severity: "info",
      message: "一般会計合計と議会費の予算・決算・執行率を突合しました",
    });
  }

  const sourcePage = relevantPages.expenditurePageIndex + 1;
  const amount = (params: {
    eventKind: "initial_budget" | "available_budget_snapshot" | "settlement";
    decisionStage: "passed" | "not_applicable";
    measure: "expenditure_budget" | "expenditure_actual";
    amountYen: bigint;
    sourceValue: string;
    council?: boolean;
  }) =>
    buildFiscalAmountRecord({
      fiscalYear: FISCAL_YEAR,
      eventKind: params.eventKind,
      decisionStage: params.decisionStage,
      measure: params.measure,
      amountYen: params.amountYen,
      sourceValueText: params.sourceValue,
      sourceValueNumeric: params.amountYen.toString(),
      sourceUnit: "yen",
      sourcePage,
      sourceTable: "一般会計 歳出",
      ...(params.eventKind === "available_budget_snapshot"
        ? { asOfDate: "2025-03-31" }
        : {}),
      ...(params.council
        ? {
            classificationKey: "council_expense",
            sourceClassificationLabel: "議会費",
          }
        : {}),
    });
  const records = [
    amount({
      eventKind: "initial_budget",
      decisionStage: "passed",
      measure: "expenditure_budget",
      amountYen: generalInitial,
      sourceValue: totalCells[0],
    }),
    amount({
      eventKind: "available_budget_snapshot",
      decisionStage: "not_applicable",
      measure: "expenditure_budget",
      amountYen: generalCurrent,
      sourceValue: totalCells[2],
    }),
    amount({
      eventKind: "settlement",
      decisionStage: "not_applicable",
      measure: "expenditure_actual",
      amountYen: generalActual,
      sourceValue: totalCells[4],
    }),
    amount({
      eventKind: "initial_budget",
      decisionStage: "passed",
      measure: "expenditure_budget",
      amountYen: councilInitial,
      sourceValue: councilCells[0],
      council: true,
    }),
    amount({
      eventKind: "available_budget_snapshot",
      decisionStage: "not_applicable",
      measure: "expenditure_budget",
      amountYen: councilCurrent,
      sourceValue: councilCells[2],
      council: true,
    }),
    amount({
      eventKind: "settlement",
      decisionStage: "not_applicable",
      measure: "expenditure_actual",
      amountYen: councilActual,
      sourceValue: councilCells[4],
      council: true,
    }),
  ];
  return { records, validationSummary };
}
