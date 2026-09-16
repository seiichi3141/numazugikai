import { describe, expect, it } from "vitest";
import {
  buildFiscalStagingRows,
  fingerprintFiscalStagingRecord,
} from "./build-fiscal-staging";

const amount = (amountYen: string) => ({
  recordKind: "amount" as const,
  sourceRecordKey: "general:expenditure-budget",
  parsedPayload: { amountYen, sourceUnit: "thousand_yen" },
  validationResults: [],
});

describe("buildFiscalStagingRows", () => {
  it("JSONのkey順に依存せず同じfingerprintを返す", () => {
    expect(
      fingerprintFiscalStagingRecord({
        recordKind: "amount",
        parsedPayload: { amountYen: "1000", sourceUnit: "yen" },
      })
    ).toBe(
      fingerprintFiscalStagingRecord({
        recordKind: "amount",
        parsedPayload: { sourceUnit: "yen", amountYen: "1000" },
      })
    );
  });

  it("新規・変更なし・変更・消滅・重複候補を区別する", () => {
    const unchanged = amount("1000");
    const changed = {
      ...amount("2000"),
      sourceRecordKey: "general:changed",
    };
    const duplicate = {
      ...amount("3000"),
      sourceRecordKey: "general:duplicate",
    };
    const conflictingDuplicate = {
      ...amount("4000"),
      sourceRecordKey: "general:duplicate",
    };
    const rows = buildFiscalStagingRows(
      [unchanged, changed, duplicate, conflictingDuplicate],
      [
        {
          targetId: "00000000-0000-0000-0000-000000000001",
          recordKind: "amount",
          sourceRecordKey: unchanged.sourceRecordKey,
          contentFingerprint: fingerprintFiscalStagingRecord(unchanged),
          parsedPayload: unchanged.parsedPayload,
        },
        {
          targetId: "00000000-0000-0000-0000-000000000002",
          recordKind: "amount",
          sourceRecordKey: changed.sourceRecordKey,
          contentFingerprint: "old",
          parsedPayload: { amountYen: "1500" },
        },
        {
          targetId: "00000000-0000-0000-0000-000000000003",
          recordKind: "coverage",
          sourceRecordKey: "missing",
          contentFingerprint: "missing-hash",
          parsedPayload: { state: "collected" },
        },
      ]
    );

    expect(rows.map((row) => row.changeKind)).toEqual([
      "unchanged",
      "changed",
      "ambiguous",
      "missing",
    ]);
    expect(rows[2].parsedPayload).toEqual({
      candidates: [duplicate.parsedPayload, conflictingDuplicate.parsedPayload],
    });
    expect(rows[2].validationResults).toContainEqual({
      ruleCode: "ambiguous_source_record_key",
      severity: "hard_error",
      message: "同じ資料内キーの候補が2件あります",
    });
  });
});
