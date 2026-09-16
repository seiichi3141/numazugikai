import "server-only";

import { createAdminClient } from "@mirai-gikai/supabase";
import type { FiscalImportBatchPage } from "../../shared/types";
import { collectFiscalValidationMessages } from "../../shared/utils/collect-fiscal-validation-messages";

export async function findFiscalImportBatches(params: {
  page: number;
  pageSize: number;
}): Promise<FiscalImportBatchPage> {
  const supabase = createAdminClient();
  const requestedPage = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const from = (requestedPage - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("fiscal_import_batches")
    .select(
      `
        id, source_kind, fiscal_year, profile_key, profile_version, status,
        discovered_count, staged_count, hard_error_count, warning_count,
        finished_at, validation_summary,
        ingestion_parse_runs!fiscal_import_batches_parse_run_id_fkey(
          parser_name, parser_version
        ),
        ingestion_source_versions!fiscal_import_batches_source_version_id_fkey(
          source_title, fetched_at, artifact_retention_state,
          ingestion_sources(url)
        )
      `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) {
    throw new Error(`財政取込バッチの取得に失敗した: ${error.message}`);
  }

  const totalCount = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, pageCount);
  if (page !== requestedPage && totalCount > 0) {
    return findFiscalImportBatches({ page, pageSize });
  }

  const batchIds = (data ?? []).map((batch) => batch.id);
  const { data: qaCounts, error: qaCountsError } = batchIds.length
    ? await supabase
        .from("fiscal_import_batch_qa_counts")
        .select("batch_id, pending_count, validation_messages")
        .in("batch_id", batchIds)
    : { data: [], error: null };
  if (qaCountsError) {
    throw new Error(`財政QA件数の取得に失敗した: ${qaCountsError.message}`);
  }
  const qaSummaryByBatchId = new Map(
    (qaCounts ?? []).map((summary) => [summary.batch_id, summary])
  );

  return {
    page,
    totalCount,
    items: (data ?? []).map((batch) => ({
      id: batch.id,
      sourceTitle:
        batch.ingestion_source_versions?.source_title ?? "資料名不明",
      sourceUrl: batch.ingestion_source_versions?.ingestion_sources?.url ?? "",
      sourceKind: batch.source_kind,
      fiscalYear: batch.fiscal_year,
      profileKey: batch.profile_key,
      profileVersion: batch.profile_version,
      parserName: batch.ingestion_parse_runs?.parser_name ?? "不明",
      parserVersion: batch.ingestion_parse_runs?.parser_version ?? "不明",
      status: batch.status,
      retentionState:
        batch.ingestion_source_versions?.artifact_retention_state ?? "不明",
      fetchedAt: batch.ingestion_source_versions?.fetched_at ?? "",
      finishedAt: batch.finished_at,
      discoveredCount: batch.discovered_count,
      stagedCount: batch.staged_count,
      hardErrorCount: batch.hard_error_count,
      warningCount: batch.warning_count,
      pendingCount: qaSummaryByBatchId.get(batch.id)?.pending_count ?? 0,
      validationMessages: collectFiscalValidationMessages(
        qaSummaryByBatchId.get(batch.id)?.validation_messages ??
          batch.validation_summary
      ),
    })),
  };
}
