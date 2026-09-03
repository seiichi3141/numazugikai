import "server-only";
import { createAdminClient } from "@mirai-gikai/supabase";
import type {
  GeneralQuestionClassificationRow,
  GeneralQuestionPolicyTopic,
  GeneralQuestionQaRow,
} from "../../shared/types";

type ParsedPayload = {
  speakerName?: unknown;
  heldOn?: unknown;
  questionKind?: unknown;
  deliveryMethod?: unknown;
  items?: unknown;
  answerers?: unknown;
};

type BatchErrorDetails = {
  validationErrors?: unknown;
};

function parseValidationErrors(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const errors = (value as BatchErrorDetails).validationErrors;
  return Array.isArray(errors)
    ? errors.filter((error): error is string => typeof error === "string")
    : [];
}

const QA_ROW_SELECT =
  "id, source_appearance_key, change_kind, qa_status, review_note, reviewed_held_on, reviewed_matched_appearance_id, parsed_payload, created_at, general_question_staging_applications(id), general_question_import_batches(error_details, ingestion_source_versions(ingestion_sources(source)))" as const;

export async function findGeneralQuestionQaRows(params: {
  page: number;
  pageSize: number;
}): Promise<{
  items: GeneralQuestionQaRow[];
  totalCount: number;
  pendingCount: number;
  page: number;
}> {
  const supabase = createAdminClient();
  const [totalResult, pendingResult] = await Promise.all([
    supabase
      .from("general_question_staging_appearances")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("general_question_staging_appearances")
      .select("id", { count: "exact", head: true })
      .eq("qa_status", "pending"),
  ]);
  const countError = totalResult.error ?? pendingResult.error;
  if (countError) {
    throw new Error(`一般質問QA件数の取得に失敗した: ${countError.message}`);
  }
  const totalCount = totalResult.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / params.pageSize));
  const page = Math.min(Math.max(params.page, 1), pageCount);
  const from = (page - 1) * params.pageSize;
  const { data: stagingRows, error: stagingError } = await supabase
    .from("general_question_staging_appearances")
    .select(QA_ROW_SELECT)
    .order("created_at", { ascending: false })
    .range(from, from + params.pageSize - 1);
  if (stagingError) {
    throw new Error(
      `一般質問QAキューの取得に失敗した: ${stagingError.message}`
    );
  }
  const effectiveDates = [
    ...new Set(
      (stagingRows ?? []).flatMap((row) => {
        const payload = row.parsed_payload as ParsedPayload;
        const heldOn =
          typeof payload.heldOn === "string" ? payload.heldOn : null;
        return (row.reviewed_held_on ?? heldOn)
          ? [row.reviewed_held_on ?? (heldOn as string)]
          : [];
      })
    ),
  ];
  const meetingsResult =
    effectiveDates.length > 0
      ? await supabase
          .from("council_meeting_revisions")
          .select("meeting_id, held_on, display_title")
          .eq("qa_status", "verified")
          .eq("publication_state", "published")
          .in("held_on", effectiveDates)
      : { data: [], error: null };
  if (meetingsResult.error) {
    throw new Error(
      `一般質問の突合会議取得に失敗した: ${meetingsResult.error.message}`
    );
  }
  const meetingIds = (meetingsResult.data ?? []).map(
    (meeting) => meeting.meeting_id
  );
  const appearancesResult =
    meetingIds.length > 0
      ? await supabase
          .from("general_question_appearance_revisions")
          .select("appearance_id, meeting_id, speaker_display_name")
          .eq("qa_status", "verified")
          .eq("publication_state", "published")
          .in("meeting_id", meetingIds)
      : { data: [], error: null };
  if (appearancesResult.error) {
    throw new Error(
      `一般質問の突合候補取得に失敗した: ${appearancesResult.error.message}`
    );
  }
  const meetingById = new Map(
    (meetingsResult.data ?? []).map((meeting) => [meeting.meeting_id, meeting])
  );
  const candidatesByDate = new Map<
    string,
    Array<{ id: string; label: string }>
  >();
  for (const appearance of appearancesResult.data ?? []) {
    const meeting = meetingById.get(appearance.meeting_id);
    if (!meeting?.held_on) continue;
    const candidates = candidatesByDate.get(meeting.held_on) ?? [];
    candidates.push({
      id: appearance.appearance_id,
      label: `${appearance.speaker_display_name}（${meeting.display_title}）`,
    });
    candidatesByDate.set(meeting.held_on, candidates);
  }

  const items = (stagingRows ?? []).map((row) => {
    const payload = row.parsed_payload as ParsedPayload;
    const heldOn = typeof payload.heldOn === "string" ? payload.heldOn : null;
    const effectiveHeldOn = row.reviewed_held_on ?? heldOn;
    return {
      id: row.id,
      sourceAppearanceKey: row.source_appearance_key,
      changeKind: row.change_kind,
      qaStatus: row.qa_status,
      reviewNote: row.review_note,
      speakerName:
        typeof payload.speakerName === "string" ? payload.speakerName : "不明",
      heldOn,
      reviewedHeldOn: row.reviewed_held_on,
      reviewedMatchedAppearanceId: row.reviewed_matched_appearance_id,
      matchCandidates: effectiveHeldOn
        ? (candidatesByDate.get(effectiveHeldOn) ?? [])
        : [],
      questionKind:
        typeof payload.questionKind === "string"
          ? payload.questionKind
          : "unknown",
      deliveryMethod:
        typeof payload.deliveryMethod === "string"
          ? payload.deliveryMethod
          : "unknown",
      itemCount: Array.isArray(payload.items) ? payload.items.length : 0,
      answerers: Array.isArray(payload.answerers)
        ? payload.answerers.filter(
            (value): value is string => typeof value === "string"
          )
        : [],
      createdAt: row.created_at,
      applied:
        Array.isArray(row.general_question_staging_applications) &&
        row.general_question_staging_applications.length > 0,
      validationErrors: parseValidationErrors(
        row.general_question_import_batches?.error_details
      ),
      sourceKind:
        row.general_question_import_batches?.ingestion_source_versions
          ?.ingestion_sources?.source ?? "unknown",
    };
  });
  return {
    items,
    totalCount,
    pendingCount: pendingResult.count ?? 0,
    page,
  };
}

export async function findFailedGeneralQuestionImports(): Promise<
  Array<{
    id: string;
    sourceTitle: string;
    sourceUrl: string;
    errors: string[];
    createdAt: string;
  }>
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("general_question_import_batches")
    .select(
      "id, error_details, created_at, ingestion_source_versions(source_title, ingestion_sources(url))"
    )
    .eq("status", "failed")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`一般質問の解析失敗一覧の取得に失敗した: ${error.message}`);
  }
  return (data ?? []).map((batch) => ({
    id: batch.id,
    sourceTitle: batch.ingestion_source_versions?.source_title ?? "資料名不明",
    sourceUrl: batch.ingestion_source_versions?.ingestion_sources?.url ?? "",
    errors: parseValidationErrors(batch.error_details),
    createdAt: batch.created_at,
  }));
}

export async function applyGeneralQuestionQaRow(input: {
  id: string;
  reviewedBy: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    "apply_verified_general_question_staging",
    { p_staging_id: input.id, p_reviewed_by: input.reviewedBy }
  );
  if (error) throw new Error(`一般質問の公開反映に失敗した: ${error.message}`);
}

export async function refreshGeneralQuestionBatch(input: {
  id: string;
  reviewedBy: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    "refresh_general_question_batch_publication",
    { p_staging_id: input.id, p_reviewed_by: input.reviewedBy }
  );
  if (error)
    throw new Error(`一般質問カバレッジの更新に失敗した: ${error.message}`);
}

export async function findGeneralQuestionClassifications(params: {
  page: number;
  pageSize: number;
}): Promise<{
  items: GeneralQuestionClassificationRow[];
  topics: GeneralQuestionPolicyTopic[];
  totalCount: number;
  page: number;
}> {
  const supabase = createAdminClient();
  const countResult = await supabase
    .from("general_question_item_revisions")
    .select("id", { count: "exact", head: true })
    .eq("qa_status", "verified")
    .eq("publication_state", "published");
  if (countResult.error) {
    throw new Error(
      `一般質問分類候補件数の取得に失敗した: ${countResult.error.message}`
    );
  }
  const totalCount = countResult.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / params.pageSize));
  const page = Math.min(Math.max(params.page, 1), pageCount);
  const from = (page - 1) * params.pageSize;
  const [itemsResult, topicsResult] = await Promise.all([
    supabase
      .from("general_question_item_revisions")
      .select("id, appearance_id, public_summary")
      .eq("qa_status", "verified")
      .eq("publication_state", "published")
      .order("created_at", { ascending: false })
      .range(from, from + params.pageSize - 1),
    supabase
      .from("policy_topics")
      .select("id, label, description")
      .eq("taxonomy_id", "10000000-0000-0000-0000-000000000001")
      .eq("is_active", true)
      .order("display_order"),
  ]);
  const initialError = itemsResult.error ?? topicsResult.error;
  if (initialError) {
    throw new Error(
      `一般質問分類候補の取得に失敗した: ${initialError.message}`
    );
  }
  const itemIds = (itemsResult.data ?? []).map((item) => item.id);
  const appearanceIds = [
    ...new Set((itemsResult.data ?? []).map((item) => item.appearance_id)),
  ];
  const [appearancesResult, setsResult] = await Promise.all([
    appearanceIds.length > 0
      ? supabase
          .from("general_question_appearance_revisions")
          .select("appearance_id, speaker_display_name")
          .eq("qa_status", "verified")
          .eq("publication_state", "published")
          .in("appearance_id", appearanceIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length > 0
      ? supabase
          .from("general_question_item_classification_sets")
          .select(
            "question_item_revision_id, general_question_item_topics(policy_topics(label))"
          )
          .eq("qa_status", "verified")
          .in("publication_state", ["reviewed", "published"])
          .in("question_item_revision_id", itemIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const relatedError = appearancesResult.error ?? setsResult.error;
  if (relatedError) {
    throw new Error(
      `一般質問分類候補の関連データ取得に失敗した: ${relatedError.message}`
    );
  }
  const speakerByAppearance = new Map(
    (appearancesResult.data ?? []).map((row) => [
      row.appearance_id,
      row.speaker_display_name,
    ])
  );
  const labelsByRevision = new Map<string, string[]>();
  for (const set of setsResult.data ?? []) {
    if (labelsByRevision.has(set.question_item_revision_id)) continue;
    labelsByRevision.set(
      set.question_item_revision_id,
      set.general_question_item_topics.flatMap((row) =>
        row.policy_topics ? [row.policy_topics.label] : []
      )
    );
  }
  return {
    items: (itemsResult.data ?? []).map((item) => ({
      itemRevisionId: item.id,
      summary: item.public_summary,
      speakerName: speakerByAppearance.get(item.appearance_id) ?? "登壇者不明",
      classifiedTopicLabels: labelsByRevision.get(item.id) ?? [],
    })),
    topics: topicsResult.data ?? [],
    totalCount,
    page,
  };
}

export async function classifyGeneralQuestionItem(input: {
  itemRevisionId: string;
  topicIds: string[];
  reviewedBy: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    "classify_general_question_item_manually",
    {
      p_question_item_revision_id: input.itemRevisionId,
      p_policy_topic_ids: input.topicIds,
      p_reviewed_by: input.reviewedBy,
    }
  );
  if (error) throw new Error(`政策分野分類の保存に失敗した: ${error.message}`);
}

export async function publishGeneralQuestionClassificationRelease(input: {
  releaseKey: string;
  reviewedBy: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    "publish_general_question_classification_release",
    { p_release_key: input.releaseKey, p_reviewed_by: input.reviewedBy }
  );
  if (error)
    throw new Error(`政策分野releaseの公開に失敗した: ${error.message}`);
}

export async function reviewGeneralQuestionQaRow(input: {
  id: string;
  qaStatus: "verified" | "rejected";
  reviewNote: string | null;
  reviewedHeldOn: string | null;
  reviewedMatchedAppearanceId: string | null;
  reviewedBy: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { data: target, error: targetError } = await supabase
    .from("general_question_staging_appearances")
    .select("change_kind, general_question_import_batches(error_details)")
    .eq("id", input.id)
    .eq("qa_status", "pending")
    .maybeSingle();
  if (targetError) {
    throw new Error(`一般質問QA対象の確認に失敗した: ${targetError.message}`);
  }
  if (!target) throw new Error("対象は既に確認済みか、存在しません");
  if (
    input.qaStatus === "verified" &&
    (target.change_kind === "missing" || target.change_kind === "ambiguous")
  ) {
    throw new Error(
      "消滅・要突合の行は承認できません。内容を確認して却下してください"
    );
  }
  if (
    input.qaStatus === "verified" &&
    parseValidationErrors(target.general_question_import_batches?.error_details)
      .length > 0
  ) {
    throw new Error("解析検証エラーがあるバッチは承認できません");
  }
  const { data, error } = await supabase
    .from("general_question_staging_appearances")
    .update({
      qa_status: input.qaStatus,
      review_note: input.reviewNote,
      reviewed_held_on: input.reviewedHeldOn,
      reviewed_matched_appearance_id: input.reviewedMatchedAppearanceId,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("qa_status", "pending")
    .select("id");
  if (error)
    throw new Error(`一般質問QA結果の保存に失敗した: ${error.message}`);
  if (data.length !== 1) throw new Error("対象は既に確認済みか、存在しません");
}
