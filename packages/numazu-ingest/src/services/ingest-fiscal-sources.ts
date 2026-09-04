import { NumazuSiteClient } from "../fetchers/numazu-site-client";
import {
  failFiscalParseRun,
  findPreviousFiscalStagingRecords,
  prepareFiscalSource,
  saveFiscalStaging,
} from "../repositories/fiscal-ingest-repository";
import {
  type FiscalSourceProfile,
  fiscalSourceProfiles,
} from "../shared/fiscal-source-profiles";
import { buildFiscalDocumentMetadataRecord } from "../shared/utils/build-fiscal-document-metadata";
import { buildFiscalStagingRows } from "../shared/utils/build-fiscal-staging";

export type IngestFiscalSourcesResult = {
  sourceCount: number;
  stagedBatchIds: string[];
  skippedCount: number;
  validationErrorCount: number;
};

type FiscalIngestRepository = {
  prepareSource: typeof prepareFiscalSource;
  saveStaging: typeof saveFiscalStaging;
  failParseRun: typeof failFiscalParseRun;
  findPreviousRecords: typeof findPreviousFiscalStagingRecords;
};

const defaultRepository: FiscalIngestRepository = {
  prepareSource: prepareFiscalSource,
  saveStaging: saveFiscalStaging,
  failParseRun: failFiscalParseRun,
  findPreviousRecords: findPreviousFiscalStagingRecords,
};

/** 初期対象の公式PDFを版保存し、数値解析前の書誌候補をQAへ積む。 */
export async function ingestFiscalSources(params: {
  ingestionRunId: string;
  client?: Pick<NumazuSiteClient, "fetchPdfDocument">;
  profiles?: readonly FiscalSourceProfile[];
  repository?: FiscalIngestRepository;
}): Promise<IngestFiscalSourcesResult> {
  const client = params.client ?? new NumazuSiteClient();
  const profiles = params.profiles ?? fiscalSourceProfiles;
  const repository = params.repository ?? defaultRepository;
  const stagedBatchIds: string[] = [];
  let skippedCount = 0;
  let validationErrorCount = 0;

  for (const profile of profiles) {
    const fetched = await client.fetchPdfDocument(profile.url);
    const prepared = await repository.prepareSource({
      ingestionRunId: params.ingestionRunId,
      fetched,
      profile,
    });
    if (prepared.alreadyParsed) {
      skippedCount += 1;
      continue;
    }
    try {
      const record = buildFiscalDocumentMetadataRecord({
        profile,
        contentHash: fetched.contentHash,
        text: fetched.text,
      });
      const previous = await repository.findPreviousRecords(profile.profileKey);
      const rows = buildFiscalStagingRows([record], previous);
      const hardErrorCount = rows
        .flatMap((row) => row.validationResults)
        .filter((validation) => validation.severity === "hard_error").length;
      validationErrorCount += hardErrorCount;
      stagedBatchIds.push(
        await repository.saveStaging({
          sourceVersionId: prepared.sourceVersionId,
          parseRunId: prepared.parseRunId,
          profile,
          rows,
          discoveredCount: 1,
          validationSummary: [],
          parseStatus: hardErrorCount > 0 ? "failed" : "completed",
        })
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      try {
        await repository.failParseRun({
          parseRunId: prepared.parseRunId,
          errorMessage,
        });
      } catch (finalizeError) {
        throw new AggregateError(
          [error, finalizeError],
          "財政資料の解析失敗を監査履歴へ記録できませんでした"
        );
      }
      throw error;
    }
  }

  return {
    sourceCount: profiles.length,
    stagedBatchIds,
    skippedCount,
    validationErrorCount,
  };
}
