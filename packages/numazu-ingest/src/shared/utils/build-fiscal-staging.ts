import { createHash } from "node:crypto";
import type { Json } from "@mirai-gikai/supabase";

export type FiscalStagingRecordKind =
  | "document_metadata"
  | "scope_membership"
  | "coverage"
  | "classification"
  | "classification_mapping"
  | "amount"
  | "bill_link";

export type FiscalStagingValidation = {
  ruleCode: string;
  severity: "hard_error" | "warning" | "info";
  message: string;
};

export type ParsedFiscalStagingRecord = {
  recordKind: FiscalStagingRecordKind;
  sourceRecordKey: string;
  parsedPayload: { [key: string]: Json | undefined };
  validationResults: FiscalStagingValidation[];
};

export type PreviousFiscalStagingRecord = {
  targetId: string;
  recordKind: FiscalStagingRecordKind;
  sourceRecordKey: string;
  contentFingerprint: string;
  parsedPayload: { [key: string]: Json | undefined };
};

export type FiscalStagingRow = ParsedFiscalStagingRecord & {
  contentFingerprint: string;
  changeKind: "new" | "changed" | "unchanged" | "missing" | "ambiguous";
  matchedTargetId: string | null;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintFiscalStagingRecord(
  record: Pick<ParsedFiscalStagingRecord, "recordKind" | "parsedPayload">
): string {
  return createHash("sha256").update(stableJson(record)).digest("hex");
}

/** 現在の解析結果と前回確定値を比較し、削除せずQA候補として返す。 */
export function buildFiscalStagingRows(
  records: readonly ParsedFiscalStagingRecord[],
  previous: readonly PreviousFiscalStagingRecord[]
): FiscalStagingRow[] {
  const identity = (record: {
    recordKind: FiscalStagingRecordKind;
    sourceRecordKey: string;
  }) => `${record.recordKind}:${record.sourceRecordKey}`;
  const previousByIdentity = new Map(
    previous.map((row) => [identity(row), row])
  );
  const recordsByIdentity = new Map<string, ParsedFiscalStagingRecord[]>();
  for (const record of records) {
    const key = identity(record);
    const group = recordsByIdentity.get(key);
    if (group) group.push(record);
    else recordsByIdentity.set(key, [record]);
  }

  const handled = new Set<string>();
  const rows: FiscalStagingRow[] = [];
  for (const record of records) {
    const key = identity(record);
    if (handled.has(key)) continue;
    handled.add(key);
    const duplicateRecords = recordsByIdentity.get(key) ?? [record];
    const normalizedRecord: ParsedFiscalStagingRecord =
      duplicateRecords.length > 1
        ? {
            recordKind: record.recordKind,
            sourceRecordKey: record.sourceRecordKey,
            parsedPayload: {
              candidates: duplicateRecords.map(
                (candidate) => candidate.parsedPayload
              ),
            },
            validationResults: [
              ...duplicateRecords.flatMap(
                (candidate) => candidate.validationResults
              ),
              {
                ruleCode: "ambiguous_source_record_key",
                severity: "hard_error",
                message: `同じ資料内キーの候補が${duplicateRecords.length}件あります`,
              },
            ],
          }
        : record;
    const contentFingerprint = fingerprintFiscalStagingRecord(normalizedRecord);
    const matched = previousByIdentity.get(key);
    previousByIdentity.delete(key);
    rows.push({
      ...normalizedRecord,
      contentFingerprint,
      changeKind:
        duplicateRecords.length > 1
          ? "ambiguous"
          : !matched
            ? "new"
            : matched.contentFingerprint === contentFingerprint
              ? "unchanged"
              : "changed",
      matchedTargetId: matched?.targetId ?? null,
    });
  }

  for (const missing of previousByIdentity.values()) {
    rows.push({
      recordKind: missing.recordKind,
      sourceRecordKey: missing.sourceRecordKey,
      contentFingerprint: missing.contentFingerprint,
      changeKind: "missing",
      matchedTargetId: missing.targetId,
      parsedPayload: missing.parsedPayload,
      validationResults: [],
    });
  }
  return rows;
}
