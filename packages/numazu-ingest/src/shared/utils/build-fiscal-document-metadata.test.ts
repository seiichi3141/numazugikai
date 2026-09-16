import { describe, expect, it } from "vitest";
import { fiscalSourceProfiles } from "../fiscal-source-profiles";
import { buildFiscalDocumentMetadataRecord } from "./build-fiscal-document-metadata";

describe("buildFiscalDocumentMetadataRecord", () => {
  const profile = fiscalSourceProfiles[0];

  it("source profileと取得hashから書誌候補を作る", () => {
    const record = buildFiscalDocumentMetadataRecord({
      profile,
      contentHash: "sha256-fixture",
      text: "令和8年度 一般会計",
    });

    expect(record.sourceRecordKey).toBe(profile.profileKey);
    expect(record.parsedPayload).toMatchObject({
      contentHash: "sha256-fixture",
      fiscalYear: 2026,
      sourceKind: "budget_overview",
    });
    expect(record.validationResults).toEqual([]);
  });

  it("テキスト層が空のPDFをhard errorにする", () => {
    const record = buildFiscalDocumentMetadataRecord({
      profile,
      contentHash: "sha256-empty",
      text: "  ",
    });

    expect(record.validationResults).toEqual([
      expect.objectContaining({
        ruleCode: "document_text_required",
        severity: "hard_error",
      }),
    ]);
  });
});
