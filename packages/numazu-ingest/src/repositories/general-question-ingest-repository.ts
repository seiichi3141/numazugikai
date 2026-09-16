import { createHash } from "node:crypto";
import { createAdminClient } from "@mirai-gikai/supabase";
import type { FetchedPdfDocument } from "../fetchers/numazu-site-client";
import type { ParsedGeneralQuestionAppearance } from "../parsers/parse-general-question-pdf";
import type {
  GeneralQuestionStagingRow,
  PreviousGeneralQuestionAppearance,
} from "../shared/utils/build-general-question-staging";

const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000001";
const PARSER_NAME = "numazu-general-question-pdf";
const PARSER_VERSION = "1.2.0";
const CONFIGURATION_HASH = createHash("sha256")
  .update("pdftotext:-layout;parser:1.2.0;legacy-layouts:2004-2009")
  .digest("hex");
const MINUTES_PARSER_NAME = "numazu-general-question-minutes";
const MINUTES_PARSER_VERSION = "1.0.0";
const MINUTES_CONFIGURATION_HASH = createHash("sha256")
  .update("amivoice:general-question-section;body-retention:none;parser:1.0.0")
  .digest("hex");

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export async function prepareGeneralQuestionSource(params: {
  ingestionRunId: string;
  fetched: FetchedPdfDocument;
  sourceTitle: string;
}): Promise<{
  sourceId: string;
  sourceVersionId: string;
  parseRunId: string;
  alreadyParsed: boolean;
}> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data: source, error: sourceError } = await supabase
    .from("ingestion_sources")
    .upsert(
      {
        source: "general_question_pdf",
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
    fail("一般質問ソースの保存に失敗した", sourceError);

  const { data: sourceVersion, error: versionError } = await supabase
    .from("ingestion_source_versions")
    .upsert(
      {
        ingestion_source_id: source.id,
        content_hash: params.fetched.contentHash,
        fetched_at: now,
        source_title: params.sourceTitle,
        etag: params.fetched.etag,
        last_modified: params.fetched.lastModified,
        media_type: "application/pdf",
        byte_size: params.fetched.bytes.byteLength,
      },
      { onConflict: "ingestion_source_id,content_hash", ignoreDuplicates: true }
    )
    .select("id, artifact_retention_state")
    .maybeSingle();
  if (versionError) fail("一般質問取得版の保存に失敗した", versionError);
  const selectedVersion =
    sourceVersion ??
    (
      await supabase
        .from("ingestion_source_versions")
        .select("id, artifact_retention_state")
        .eq("ingestion_source_id", source.id)
        .eq("content_hash", params.fetched.contentHash)
        .single()
    ).data;
  if (!selectedVersion) throw new Error("一般質問取得版を再取得できなかった");

  if (selectedVersion.artifact_retention_state === "pending") {
    const objectKey = `general-questions/${source.id}/${params.fetched.contentHash}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("source-artifacts")
      .upload(objectKey, params.fetched.bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadError && !/already exists/i.test(uploadError.message)) {
      fail("一般質問PDF原本の保持に失敗した", uploadError);
    }
    const { error: retentionError } = await supabase.rpc(
      "transition_ingestion_source_version_retention",
      {
        p_source_version_id: selectedVersion.id,
        p_to_state: "retained",
        p_changed_by: SYSTEM_ACTOR_ID,
        p_reason: "一般質問PDF取込時の原本保持",
        p_private_object_key: objectKey,
      }
    );
    if (retentionError)
      fail("一般質問PDF保持状態の更新に失敗した", retentionError);
  }

  const { data: completed, error: completedError } = await supabase
    .from("ingestion_parse_runs")
    .select("id")
    .eq("source_version_id", selectedVersion.id)
    .eq("parser_name", PARSER_NAME)
    .eq("parser_version", PARSER_VERSION)
    .eq("configuration_hash", CONFIGURATION_HASH)
    .eq("status", "completed")
    .maybeSingle();
  if (completedError) fail("解析済み取得版の確認に失敗した", completedError);
  if (completed) {
    return {
      sourceId: source.id,
      sourceVersionId: selectedVersion.id,
      parseRunId: completed.id,
      alreadyParsed: true,
    };
  }

  const { data: parseRun, error: parseRunError } = await supabase
    .from("ingestion_parse_runs")
    .insert({
      ingestion_run_id: params.ingestionRunId,
      source_version_id: selectedVersion.id,
      parser_name: PARSER_NAME,
      parser_version: PARSER_VERSION,
      configuration_hash: CONFIGURATION_HASH,
    })
    .select("id")
    .single();
  if (parseRunError || !parseRun)
    fail("一般質問解析実行の開始に失敗した", parseRunError);
  return {
    sourceId: source.id,
    sourceVersionId: selectedVersion.id,
    parseRunId: parseRun.id,
    alreadyParsed: false,
  };
}

/** AmiVoice本文を保存せず、取得ハッシュと解析監査だけを残す。 */
export async function prepareGeneralQuestionMinutesSource(params: {
  ingestionRunId: string;
  url: string;
  sourceTitle: string;
  transientText: string;
}): Promise<{
  sourceId: string;
  sourceVersionId: string;
  parseRunId: string;
  alreadyParsed: boolean;
}> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const contentHash = createHash("sha256")
    .update(params.transientText)
    .digest("hex");
  const { data: source, error: sourceError } = await supabase
    .from("ingestion_sources")
    .upsert(
      {
        source: "general_question_record",
        url: params.url,
        content_hash: contentHash,
        last_fetched_at: now,
      },
      { onConflict: "source,url" }
    )
    .select("id")
    .single();
  if (sourceError || !source) {
    fail("一般質問会議記録ソースの保存に失敗した", sourceError);
  }
  const { data: insertedVersion, error: versionError } = await supabase
    .from("ingestion_source_versions")
    .upsert(
      {
        ingestion_source_id: source.id,
        content_hash: contentHash,
        fetched_at: now,
        source_title: params.sourceTitle,
        media_type: "text/html",
        byte_size: new TextEncoder().encode(params.transientText).byteLength,
      },
      { onConflict: "ingestion_source_id,content_hash", ignoreDuplicates: true }
    )
    .select("id, artifact_retention_state")
    .maybeSingle();
  if (versionError) fail("一般質問会議記録版の保存に失敗した", versionError);
  const selectedVersion =
    insertedVersion ??
    (
      await supabase
        .from("ingestion_source_versions")
        .select("id, artifact_retention_state")
        .eq("ingestion_source_id", source.id)
        .eq("content_hash", contentHash)
        .single()
    ).data;
  if (!selectedVersion)
    throw new Error("一般質問会議記録版を再取得できなかった");
  if (selectedVersion.artifact_retention_state === "pending") {
    const { error } = await supabase.rpc(
      "transition_ingestion_source_version_retention",
      {
        p_source_version_id: selectedVersion.id,
        p_to_state: "not_permitted",
        p_changed_by: SYSTEM_ACTOR_ID,
        p_reason: "会議記録本文を永続化しないデータ契約",
      }
    );
    if (error) fail("一般質問会議記録の非保持設定に失敗した", error);
  }
  const { data: completed, error: completedError } = await supabase
    .from("ingestion_parse_runs")
    .select("id")
    .eq("source_version_id", selectedVersion.id)
    .eq("parser_name", MINUTES_PARSER_NAME)
    .eq("parser_version", MINUTES_PARSER_VERSION)
    .eq("configuration_hash", MINUTES_CONFIGURATION_HASH)
    .eq("status", "completed")
    .maybeSingle();
  if (completedError)
    fail("一般質問会議記録の解析済み確認に失敗した", completedError);
  if (completed) {
    return {
      sourceId: source.id,
      sourceVersionId: selectedVersion.id,
      parseRunId: completed.id,
      alreadyParsed: true,
    };
  }
  const { data: parseRun, error: parseRunError } = await supabase
    .from("ingestion_parse_runs")
    .insert({
      ingestion_run_id: params.ingestionRunId,
      source_version_id: selectedVersion.id,
      parser_name: MINUTES_PARSER_NAME,
      parser_version: MINUTES_PARSER_VERSION,
      configuration_hash: MINUTES_CONFIGURATION_HASH,
    })
    .select("id")
    .single();
  if (parseRunError || !parseRun) {
    fail("一般質問会議記録の解析実行開始に失敗した", parseRunError);
  }
  return {
    sourceId: source.id,
    sourceVersionId: selectedVersion.id,
    parseRunId: parseRun.id,
    alreadyParsed: false,
  };
}

export async function findCouncilSessionForAppearances(
  appearances: readonly ParsedGeneralQuestionAppearance[]
): Promise<string | null> {
  const dates = appearances
    .map((appearance) => appearance.heldOn)
    .filter((date): date is string => date !== null)
    .sort();
  if (dates.length === 0) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("council_sessions")
    .select("id")
    .lte("start_date", dates[0])
    .gte("end_date", dates.at(-1) as string)
    .limit(2);
  if (error) fail("一般質問の会期突合に失敗した", error);
  return data?.length === 1 ? data[0].id : null;
}

/** 同じ公式URLで最後に公開反映した解析結果を差分比較用に取得する。 */
export async function findPreviousGeneralQuestionAppearances(
  ingestionSourceId: string
): Promise<PreviousGeneralQuestionAppearance[]> {
  const supabase = createAdminClient();
  const { data: versions, error: versionError } = await supabase
    .from("ingestion_source_versions")
    .select("id")
    .eq("ingestion_source_id", ingestionSourceId);
  if (versionError) fail("一般質問の過去取得版の取得に失敗した", versionError);
  const versionIds = (versions ?? []).map((version) => version.id);
  if (versionIds.length === 0) return [];

  const { data: batch, error: batchError } = await supabase
    .from("general_question_import_batches")
    .select("id")
    .in("source_version_id", versionIds)
    .eq("status", "applied")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (batchError) fail("一般質問の過去バッチの取得に失敗した", batchError);
  if (!batch) return [];

  const { data: rows, error: rowError } = await supabase
    .from("general_question_staging_appearances")
    .select("id, source_appearance_key, content_fingerprint, parsed_payload")
    .eq("batch_id", batch.id);
  if (rowError) fail("一般質問の過去解析結果の取得に失敗した", rowError);
  const rowIds = (rows ?? []).map((row) => row.id);
  if (rowIds.length === 0) return [];
  const { data: applications, error: applicationError } = await supabase
    .from("general_question_staging_applications")
    .select("staging_id, appearance_id")
    .in("staging_id", rowIds);
  if (applicationError) {
    fail("一般質問の過去反映結果の取得に失敗した", applicationError);
  }
  const appearanceIdByStaging = new Map(
    (applications ?? []).map((application) => [
      application.staging_id,
      application.appearance_id,
    ])
  );
  return (rows ?? []).flatMap((row) => {
    const appearanceId = appearanceIdByStaging.get(row.id);
    return appearanceId
      ? [
          {
            appearanceId,
            sourceKey: row.source_appearance_key,
            contentFingerprint: row.content_fingerprint,
            parsedPayload:
              row.parsed_payload as ParsedGeneralQuestionAppearance,
          },
        ]
      : [];
  });
}

export async function saveGeneralQuestionStaging(params: {
  sourceVersionId: string;
  parseRunId: string;
  councilSessionId: string | null;
  rows: readonly GeneralQuestionStagingRow[];
  discoveredCount: number;
  validationErrors: string[];
  parseStatus?: "completed" | "failed";
}): Promise<string> {
  const supabase = createAdminClient();
  const finishedAt = new Date().toISOString();
  const { data: batchId, error } = await supabase.rpc(
    "save_general_question_staging",
    {
      p_source_version_id: params.sourceVersionId,
      p_parse_run_id: params.parseRunId,
      p_council_session_id: params.councilSessionId ?? undefined,
      p_rows: params.rows.map((row) => ({
        source_appearance_key: row.sourceKey,
        content_fingerprint: row.contentFingerprint,
        change_kind: row.changeKind,
        matched_appearance_id: row.matchedAppearanceId,
        parsed_payload: row.parsedPayload,
      })),
      p_discovered_count: params.discoveredCount,
      p_validation_errors: params.validationErrors,
      p_parse_status: params.parseStatus ?? "completed",
      p_finished_at: finishedAt,
    }
  );
  if (error || !batchId) fail("一般質問stagingの原子的な保存に失敗した", error);
  return batchId;
}
