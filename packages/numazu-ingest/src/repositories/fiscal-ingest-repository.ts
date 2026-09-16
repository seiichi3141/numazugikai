import { createHash } from "node:crypto";
import { createAdminClient, type Json } from "@mirai-gikai/supabase";
import type { FetchedPdfDocument } from "../fetchers/numazu-site-client";
import type { FiscalSourceProfile } from "../shared/fiscal-source-profiles";
import type {
  FiscalStagingRow,
  PreviousFiscalStagingRecord,
} from "../shared/utils/build-fiscal-staging";
import { isTerminalFiscalParseRun } from "../shared/utils/is-terminal-fiscal-parse-run";

const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000001";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

function configurationHash(profile: FiscalSourceProfile): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        expectedMediaType: profile.expectedMediaType,
        fiscalYear: profile.fiscalYear,
        profileKey: profile.profileKey,
        profileVersion: profile.profileVersion,
        parserKind: profile.parserKind,
        seriesCode: profile.seriesCode,
        sourceKind: profile.sourceKind,
      })
    )
    .digest("hex");
}

export async function prepareFiscalSource(params: {
  ingestionRunId: string;
  fetched: FetchedPdfDocument;
  profile: FiscalSourceProfile;
}): Promise<{
  sourceId: string;
  sourceVersionId: string;
  parseRunId: string;
  alreadyParsed: boolean;
}> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const sourceName = `fiscal_${params.profile.sourceKind}`;
  const { data: source, error: sourceError } = await supabase
    .from("ingestion_sources")
    .upsert(
      {
        source: sourceName,
        url: params.fetched.url,
        content_hash: params.fetched.contentHash,
        etag: params.fetched.etag,
        last_modified: params.fetched.lastModified,
        last_fetched_at: now,
      },
      { onConflict: "source,url" }
    )
    .select("id")
    .single();
  if (sourceError || !source)
    fail("財政資料ソースの保存に失敗した", sourceError);

  const { data: insertedVersion, error: versionError } = await supabase
    .from("ingestion_source_versions")
    .upsert(
      {
        ingestion_source_id: source.id,
        content_hash: params.fetched.contentHash,
        fetched_at: now,
        source_title: params.profile.title,
        etag: params.fetched.etag,
        last_modified: params.fetched.lastModified,
        media_type: params.profile.expectedMediaType,
        byte_size: params.fetched.bytes.byteLength,
      },
      { onConflict: "ingestion_source_id,content_hash", ignoreDuplicates: true }
    )
    .select("id, artifact_retention_state")
    .maybeSingle();
  if (versionError) fail("財政資料取得版の保存に失敗した", versionError);
  let selectedVersion = insertedVersion;
  if (!selectedVersion) {
    const { data: existingVersion, error: existingVersionError } =
      await supabase
        .from("ingestion_source_versions")
        .select("id, artifact_retention_state")
        .eq("ingestion_source_id", source.id)
        .eq("content_hash", params.fetched.contentHash)
        .single();
    if (existingVersionError) {
      fail("財政資料取得版の再取得に失敗した", existingVersionError);
    }
    selectedVersion = existingVersion;
  }
  if (!selectedVersion) throw new Error("財政資料取得版を再取得できなかった");

  if (selectedVersion.artifact_retention_state === "pending") {
    const objectKey = `fiscal/${params.profile.seriesCode}/${params.profile.fiscalYear}/${params.fetched.contentHash}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("source-artifacts")
      .upload(objectKey, params.fetched.bytes, {
        contentType: params.profile.expectedMediaType,
        upsert: false,
      });
    if (uploadError && !/already exists/i.test(uploadError.message)) {
      fail("財政資料原本の非公開保存に失敗した", uploadError);
    }
    const { error: retentionError } = await supabase.rpc(
      "transition_ingestion_source_version_retention",
      {
        p_source_version_id: selectedVersion.id,
        p_to_state: "retained",
        p_changed_by: SYSTEM_ACTOR_ID,
        p_reason: "財政資料取込時の監査原本保持",
        p_private_object_key: objectKey,
      }
    );
    if (retentionError) {
      const { data: currentVersion, error: currentVersionError } =
        await supabase
          .from("ingestion_source_versions")
          .select("artifact_retention_state, private_object_key")
          .eq("id", selectedVersion.id)
          .single();
      if (
        currentVersionError ||
        currentVersion?.artifact_retention_state !== "retained" ||
        currentVersion.private_object_key !== objectKey
      ) {
        fail("財政資料原本の保持状態更新に失敗した", retentionError);
      }
    }
  }

  const profileHash = configurationHash(params.profile);
  const { data: terminalRuns, error: terminalRunsError } = await supabase
    .from("ingestion_parse_runs")
    .select("id, status, parse_stats")
    .eq("source_version_id", selectedVersion.id)
    .eq("parser_name", params.profile.parserName)
    .eq("parser_version", params.profile.parserVersion)
    .eq("configuration_hash", profileHash)
    .in("status", ["completed", "failed", "rejected"])
    .order("finished_at", { ascending: false });
  if (terminalRunsError) {
    fail("財政資料の解析済み確認に失敗した", terminalRunsError);
  }
  const terminalRun = terminalRuns?.find((run) =>
    isTerminalFiscalParseRun({
      status: run.status,
      parseStats: run.parse_stats,
    })
  );
  if (terminalRun) {
    return {
      sourceId: source.id,
      sourceVersionId: selectedVersion.id,
      parseRunId: terminalRun.id,
      alreadyParsed: true,
    };
  }

  const { data: parseRun, error: parseRunError } = await supabase
    .from("ingestion_parse_runs")
    .insert({
      ingestion_run_id: params.ingestionRunId,
      source_version_id: selectedVersion.id,
      parser_name: params.profile.parserName,
      parser_version: params.profile.parserVersion,
      configuration_hash: profileHash,
    })
    .select("id")
    .single();
  if (parseRunError || !parseRun) {
    fail("財政資料解析実行の開始に失敗した", parseRunError);
  }
  return {
    sourceId: source.id,
    sourceVersionId: selectedVersion.id,
    parseRunId: parseRun.id,
    alreadyParsed: false,
  };
}

/** staging保存前の運用上の失敗を再試行可能として解析履歴へ残す。 */
export async function failFiscalParseRun(params: {
  parseRunId: string;
  errorMessage: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("finalize_ingestion_parse_run", {
    p_parse_run_id: params.parseRunId,
    p_status: "failed",
    p_parse_stats: {
      error: params.errorMessage,
      retryable: true,
    },
  });
  if (error) fail("財政資料解析失敗の記録に失敗した", error);
}

/** 同じprofileで最後に適用した候補を、改訂版の差分比較に利用する。 */
export async function findPreviousFiscalStagingRecords(
  profileKey: string
): Promise<PreviousFiscalStagingRecord[]> {
  const supabase = createAdminClient();
  const { data: batch, error: batchError } = await supabase
    .from("fiscal_import_batches")
    .select("id")
    .eq("profile_key", profileKey)
    .eq("status", "applied")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (batchError) {
    fail("財政資料の前回適用バッチ取得に失敗した", batchError);
  }
  if (!batch) return [];

  const { data: records, error: recordsError } = await supabase
    .from("fiscal_staging_records")
    .select(
      "id, record_kind, source_record_key, content_fingerprint, matched_target_id, parsed_payload"
    )
    .eq("batch_id", batch.id);
  if (recordsError) {
    fail("財政資料の前回適用候補取得に失敗した", recordsError);
  }
  return (records ?? []).map((record) => ({
    targetId: record.id,
    recordKind: record.record_kind,
    sourceRecordKey: record.source_record_key,
    contentFingerprint: record.content_fingerprint,
    parsedPayload:
      record.parsed_payload as PreviousFiscalStagingRecord["parsedPayload"],
  }));
}

export async function saveFiscalStaging(params: {
  sourceVersionId: string;
  parseRunId: string;
  profile: FiscalSourceProfile;
  rows: readonly FiscalStagingRow[];
  discoveredCount: number;
  validationSummary: readonly Json[];
  parseStatus?: "completed" | "failed";
}): Promise<string> {
  const supabase = createAdminClient();
  const { data: batchId, error } = await supabase.rpc("save_fiscal_staging", {
    p_source_version_id: params.sourceVersionId,
    p_parse_run_id: params.parseRunId,
    p_source_kind: params.profile.sourceKind,
    p_profile_key: params.profile.profileKey,
    p_profile_version: params.profile.profileVersion,
    p_fiscal_year: params.profile.fiscalYear,
    p_rows: params.rows.map((row) => ({
      record_kind: row.recordKind,
      source_record_key: row.sourceRecordKey,
      content_fingerprint: row.contentFingerprint,
      change_kind: row.changeKind,
      matched_target_id: row.matchedTargetId,
      parsed_payload: row.parsedPayload,
      validation_results: row.validationResults.map((validation) => ({
        rule_code: validation.ruleCode,
        severity: validation.severity,
        message: validation.message,
      })),
    })) as Json,
    p_discovered_count: params.discoveredCount,
    p_validation_summary: [...params.validationSummary],
    p_parse_status: params.parseStatus ?? "completed",
  });
  if (error || !batchId) fail("財政stagingの原子的な保存に失敗した", error);
  return batchId;
}
