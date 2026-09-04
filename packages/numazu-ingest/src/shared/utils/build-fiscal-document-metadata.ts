import type { FiscalSourceProfile } from "../fiscal-source-profiles";
import type {
  FiscalStagingValidation,
  ParsedFiscalStagingRecord,
} from "./build-fiscal-staging";

export function buildFiscalDocumentMetadataRecord(params: {
  profile: FiscalSourceProfile;
  contentHash: string;
  text: string;
}): ParsedFiscalStagingRecord {
  const validationResults: FiscalStagingValidation[] = [];
  if (params.text.trim().length === 0) {
    validationResults.push({
      ruleCode: "document_text_required",
      severity: "hard_error",
      message: "PDFのテキストレイヤーを抽出できませんでした",
    });
  }
  return {
    recordKind: "document_metadata",
    sourceRecordKey: params.profile.profileKey,
    parsedPayload: {
      contentHash: params.contentHash,
      fiscalYear: params.profile.fiscalYear,
      seriesCode: params.profile.seriesCode,
      sourceKind: params.profile.sourceKind,
      title: params.profile.title,
      url: params.profile.url,
    },
    validationResults,
  };
}
