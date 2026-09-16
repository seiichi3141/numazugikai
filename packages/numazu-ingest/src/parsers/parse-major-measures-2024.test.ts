import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMajorMeasures2024 } from "./parse-major-measures-2024";

const fixture = readFileSync(
  new URL(
    "./__fixtures__/fiscal-major-measures-2024-layout.txt",
    import.meta.url
  ),
  "utf8"
);

describe("parseMajorMeasures2024", () => {
  it("一般会計と議会費の当初予算・予算現額・決算を抽出する", () => {
    const result = parseMajorMeasures2024(fixture);

    expect(result.records).toHaveLength(6);
    expect(
      result.records.map((record) => ({
        amountYen: record.parsedPayload.amountYen,
        classificationKey: record.parsedPayload.classificationKey,
        eventKind: record.parsedPayload.eventKind,
        asOfDate: record.parsedPayload.asOfDate,
      }))
    ).toEqual([
      {
        amountYen: "87960000000",
        classificationKey: null,
        eventKind: "initial_budget",
        asOfDate: null,
      },
      {
        amountYen: "106430416000",
        classificationKey: null,
        eventKind: "available_budget_snapshot",
        asOfDate: "2025-03-31",
      },
      {
        amountYen: "92736569118",
        classificationKey: null,
        eventKind: "settlement",
        asOfDate: null,
      },
      {
        amountYen: "460162000",
        classificationKey: "council_expense",
        eventKind: "initial_budget",
        asOfDate: null,
      },
      {
        amountYen: "464149000",
        classificationKey: "council_expense",
        eventKind: "available_budget_snapshot",
        asOfDate: "2025-03-31",
      },
      {
        amountYen: "449516456",
        classificationKey: "council_expense",
        eventKind: "settlement",
        asOfDate: null,
      },
    ]);
    expect(result.validationSummary).toContainEqual(
      expect.objectContaining({
        ruleCode: "major_measures_execution_rate_matched",
        severity: "info",
        publishedMetricValue: "96.8",
        calculatedMetricValue: "96.8",
        classificationKey: "council_expense",
      })
    );
    expect(result.validationSummary).toContainEqual(
      expect.objectContaining({
        ruleCode: "major_measures_control_totals_passed",
        severity: "info",
      })
    );
  });

  it("公表執行率と円単位の再計算が不一致ならhard errorにする", () => {
    const result = parseMajorMeasures2024(fixture.replace("96.8", "96.7"));

    expect(result.records).toHaveLength(6);
    expect(result.validationSummary).toContainEqual(
      expect.objectContaining({
        ruleCode: "major_measures_execution_rate_mismatch",
        severity: "hard_error",
      })
    );
  });

  it("予算推移の本文と歳出表合計が不一致ならhard errorにする", () => {
    const result = parseMajorMeasures2024(
      fixture.replace("87,960,000 千円", "87,960,001 千円")
    );

    expect(result.records).toHaveLength(6);
    expect(result.validationSummary).toContainEqual(
      expect.objectContaining({
        ruleCode: "major_measures_budget_control_total_mismatch",
        severity: "hard_error",
      })
    );
  });

  it("列見出しが変わった場合は静かに誤読せず失敗する", () => {
    const changed = fixture.replace("当初予算額", "変更された列");
    expect(changed).not.toBe(fixture);
    const result = parseMajorMeasures2024(changed);

    expect(result.records).toEqual([]);
    expect(result.validationSummary).toContainEqual(
      expect.objectContaining({
        ruleCode: "major_measures_table_schema_missing",
        severity: "hard_error",
      })
    );
  });

  it("対象年度が変わった場合は値を返さず失敗する", () => {
    const result = parseMajorMeasures2024(
      fixture.replace("令和６年度", "令和７年度")
    );

    expect(result.records).toEqual([]);
    expect(result.validationSummary).toContainEqual(
      expect.objectContaining({
        ruleCode: "major_measures_document_identity_mismatch",
        severity: "hard_error",
      })
    );
  });

  it("年度見出しに空白が入っても対象資料として処理する", () => {
    const changed = fixture.replace("令和６年度", "令和 ６ 年度");

    expect(parseMajorMeasures2024(changed).records).toHaveLength(6);
  });
});
