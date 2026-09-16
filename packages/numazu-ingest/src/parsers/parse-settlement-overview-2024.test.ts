import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSettlementOverview2024 } from "./parse-settlement-overview-2024";

const fixture = readFileSync(
  new URL(
    "./__fixtures__/fiscal-settlement-overview-2024-layout.txt",
    import.meta.url
  ),
  "utf8"
);

describe("parseSettlementOverview2024", () => {
  it("一般会計の千円単位の歳入・歳出決算額を比較用根拠として抽出する", () => {
    const result = parseSettlementOverview2024(fixture);

    expect(result.records).toHaveLength(2);
    expect(
      result.records.map((record) => ({
        amountYen: record.parsedPayload.amountYen,
        measure: record.parsedPayload.measure,
        precision: record.parsedPayload.sourcePrecisionYen,
        evidenceRole: record.parsedPayload.evidenceRole,
        tolerance: record.parsedPayload.comparisonToleranceYen,
      }))
    ).toEqual([
      {
        amountYen: "96520466000",
        measure: "revenue_actual",
        precision: 1000,
        evidenceRole: "corroborating",
        tolerance: 500,
      },
      {
        amountYen: "92736569000",
        measure: "expenditure_actual",
        precision: 1000,
        evidenceRole: "corroborating",
        tolerance: 500,
      },
    ]);
    expect(result.records[0]?.validationResults).toContainEqual(
      expect.objectContaining({
        ruleCode: "settlement_overview_rounded_to_thousand_yen",
        severity: "info",
      })
    );
    expect(result.validationSummary).not.toContainEqual(
      expect.objectContaining({ severity: "hard_error" })
    );
  });

  it("資料見出しや金額構造が変わった場合は値を返さず失敗する", () => {
    const result = parseSettlementOverview2024(
      fixture.replace("令和６年度", "令和７年度")
    );

    expect(result.records).toEqual([]);
    expect(result.validationSummary).toContainEqual(
      expect.objectContaining({
        ruleCode: "settlement_overview_schema_missing",
        severity: "hard_error",
      })
    );
  });

  it("金額の単位が想定外なら値を返さず失敗する", () => {
    const result = parseSettlementOverview2024(
      fixture.replace("3,656 万 9 千円", "3,656 万 900 百円")
    );

    expect(result.records).toEqual([]);
    expect(result.validationSummary).toContainEqual(
      expect.objectContaining({
        ruleCode: "settlement_overview_amounts_invalid",
        severity: "hard_error",
      })
    );
  });
});
