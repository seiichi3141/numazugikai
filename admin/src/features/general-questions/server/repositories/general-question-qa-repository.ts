import "server-only";
import { createAdminClient } from "@mirai-gikai/supabase";
import type {
  GeneralQuestionClassificationRow,
  GeneralQuestionPolicyTopic,
  GeneralQuestionQaRow,
} from "../../shared/types";
import {
  GENERAL_QUESTION_SUMMARY_MAX_LENGTH,
  type GeneralQuestionSourceItem,
} from "../../shared/utils/general-question-summary";
import {
  parseGeneralQuestionSourceItems,
  parseGeneralQuestionSummaryMap,
} from "../../shared/utils/parse-general-question-qa-payload";

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
  "id, source_appearance_key, change_kind, qa_status, review_note, reviewed_held_on, matched_appearance_id, reviewed_matched_appearance_id, parsed_payload, generated_public_summaries, reviewed_public_summaries, summary_generation_model, summary_prompt_version, created_at, general_question_staging_applications(id), general_question_import_batches(error_details, ingestion_source_versions(ingestion_sources(source)))" as const;

async function findPdfBackedAppearanceIds(
  supabase: ReturnType<typeof createAdminClient>,
  appearanceIds: string[]
): Promise<Set<string>> {
  if (appearanceIds.length === 0) return new Set();
  const { data: pdfSources, error: sourceError } = await supabase
    .from("ingestion_sources")
    .select("id")
    .eq("source", "general_question_pdf");
  if (sourceError) {
    throw new Error(`一般質問PDF出典の取得に失敗した: ${sourceError.message}`);
  }
  const sourceIds = (pdfSources ?? []).map((source) => source.id);
  if (sourceIds.length === 0) return new Set();
  const { data: evidence, error: evidenceError } = await supabase
    .from("general_question_appearance_sources")
    .select("appearance_id")
    .in("appearance_id", appearanceIds)
    .in("ingestion_source_id", sourceIds)
    .eq("role", "primary")
    .eq("qa_status", "verified");
  if (evidenceError) {
    throw new Error(
      `一般質問PDF根拠の取得に失敗した: ${evidenceError.message}`
    );
  }
  return new Set((evidence ?? []).map((row) => row.appearance_id));
}

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
  const pdfBackedAppearanceIds = await findPdfBackedAppearanceIds(
    supabase,
    (appearancesResult.data ?? []).map((appearance) => appearance.appearance_id)
  );
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
    const parsedItems = parseGeneralQuestionSourceItems(payload.items);
    const generatedSummaries = parseGeneralQuestionSummaryMap(
      row.generated_public_summaries
    );
    const reviewedSummaries = parseGeneralQuestionSummaryMap(
      row.reviewed_public_summaries
    );
    const heldOn = typeof payload.heldOn === "string" ? payload.heldOn : null;
    const effectiveHeldOn = row.reviewed_held_on ?? heldOn;
    const sourceKind =
      row.general_question_import_batches?.ingestion_source_versions
        ?.ingestion_sources?.source ?? "unknown";
    const dateCandidates = effectiveHeldOn
      ? (candidatesByDate.get(effectiveHeldOn) ?? [])
      : [];
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
      matchedAppearanceId: row.matched_appearance_id,
      reviewedMatchedAppearanceId: row.reviewed_matched_appearance_id,
      matchCandidates:
        sourceKind === "general_question_record"
          ? dateCandidates.filter((candidate) =>
              pdfBackedAppearanceIds.has(candidate.id)
            )
          : dateCandidates,
      questionKind:
        typeof payload.questionKind === "string"
          ? payload.questionKind
          : "unknown",
      deliveryMethod:
        typeof payload.deliveryMethod === "string"
          ? payload.deliveryMethod
          : "unknown",
      items: parsedItems.map((item) => ({
        ...item,
        generatedSummary: generatedSummaries[item.sourceKey] ?? null,
        reviewedSummary: reviewedSummaries[item.sourceKey] ?? null,
      })),
      summaryGenerationModel: row.summary_generation_model,
      summaryPromptVersion: row.summary_prompt_version,
      answerers: Array.isArray(payload.answerers)
        ? payload.answerers.filter(
            (value): value is string => typeof value === "string"
          )
        : [],
      createdAt: row.created_at,
      applied: row.general_question_staging_applications !== null,
      validationErrors: parseValidationErrors(
        row.general_question_import_batches?.error_details
      ),
      sourceKind,
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
            "question_item_revision_id, general_question_item_topics(policy_topics(id, label))"
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
  const topicIdsByRevision = new Map<string, string[]>();
  for (const set of setsResult.data ?? []) {
    if (labelsByRevision.has(set.question_item_revision_id)) continue;
    topicIdsByRevision.set(
      set.question_item_revision_id,
      set.general_question_item_topics.flatMap((row) =>
        row.policy_topics ? [row.policy_topics.id] : []
      )
    );
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
      classifiedTopicIds: topicIdsByRevision.get(item.id) ?? [],
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
  reviewedMatchDecisionSubmitted: boolean;
  reviewedPublicSummaries: Record<string, string>;
  reviewedBy: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { data: target, error: targetError } = await supabase
    .from("general_question_staging_appearances")
    .select(
      "change_kind, parsed_payload, summary_generation_model, general_question_import_batches(error_details, ingestion_source_versions(ingestion_sources(source)))"
    )
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
  if (input.qaStatus === "verified") {
    if (
      target.change_kind === "unchanged" &&
      input.reviewedMatchDecisionSubmitted &&
      input.reviewedMatchedAppearanceId === null
    ) {
      throw new Error("変更なしの行は既存の登壇枠との突合を解除できません");
    }
    const sourceItems = parseGeneralQuestionSourceItems(
      (target.parsed_payload as ParsedPayload).items
    );
    const isRecordSource =
      target.general_question_import_batches?.ingestion_source_versions
        ?.ingestion_sources?.source === "general_question_record";
    const isEvidenceOnlyRecordMatch =
      isRecordSource &&
      input.reviewedMatchedAppearanceId !== null &&
      (
        await findPdfBackedAppearanceIds(supabase, [
          input.reviewedMatchedAppearanceId,
        ])
      ).has(input.reviewedMatchedAppearanceId);
    if (
      isRecordSource &&
      input.reviewedMatchedAppearanceId !== null &&
      !isEvidenceOnlyRecordMatch
    ) {
      throw new Error("突合先には人手確認済みのPDF正本根拠が必要です");
    }
    const requiredSummaryItems =
      target.change_kind === "unchanged" || isEvidenceOnlyRecordMatch
        ? []
        : sourceItems;
    if (requiredSummaryItems.length > 0 && !target.summary_generation_model) {
      throw new Error("承認前にAI要約を生成してください");
    }
    if (!isEvidenceOnlyRecordMatch) {
      const sourceKeys = new Set(
        requiredSummaryItems.map((item) => item.sourceKey)
      );
      const submittedKeys = Object.keys(input.reviewedPublicSummaries);
      if (
        submittedKeys.length !== sourceKeys.size ||
        submittedKeys.some((key) => !sourceKeys.has(key))
      ) {
        throw new Error("確認済み要約の項目が原資料と一致しません");
      }
      for (const item of requiredSummaryItems) {
        const summary = input.reviewedPublicSummaries[item.sourceKey]?.trim();
        if (!summary || summary.length > GENERAL_QUESTION_SUMMARY_MAX_LENGTH) {
          throw new Error(`確認済み要約が不正です: ${item.sourceKey}`);
        }
      }
    }
  }
  const { data, error } = await supabase
    .from("general_question_staging_appearances")
    .update({
      qa_status: input.qaStatus,
      review_note: input.reviewNote,
      reviewed_held_on: input.reviewedHeldOn,
      reviewed_matched_appearance_id: input.reviewedMatchedAppearanceId,
      reviewed_match_confirmed:
        input.qaStatus === "verified" && input.reviewedMatchDecisionSubmitted,
      reviewed_public_summaries:
        input.qaStatus === "verified" ? input.reviewedPublicSummaries : {},
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

export async function findGeneralQuestionSummarySource(id: string): Promise<{
  speakerName: string;
  items: GeneralQuestionSourceItem[];
}> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("general_question_staging_appearances")
    .select(
      "change_kind, parsed_payload, general_question_import_batches(error_details, ingestion_source_versions(ingestion_sources(source)))"
    )
    .eq("id", id)
    .eq("qa_status", "pending")
    .maybeSingle();
  if (error)
    throw new Error(`一般質問要約対象の取得に失敗した: ${error.message}`);
  if (!data) throw new Error("対象は既に確認済みか、存在しません");
  if (
    data.change_kind === "unchanged" ||
    data.change_kind === "missing" ||
    data.change_kind === "ambiguous" ||
    parseValidationErrors(data.general_question_import_batches?.error_details)
      .length > 0
  ) {
    throw new Error("この行はAI要約を生成できません");
  }
  const payload = data.parsed_payload as ParsedPayload;
  const items = parseGeneralQuestionSourceItems(payload.items);
  if (items.length === 0) throw new Error("要約対象の質問項目がありません");
  return {
    speakerName:
      typeof payload.speakerName === "string" ? payload.speakerName : "不明",
    items,
  };
}

export async function saveGeneratedGeneralQuestionSummaries(input: {
  id: string;
  summaries: Record<string, string>;
  model: string;
  promptVersion: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("general_question_staging_appearances")
    .update({
      generated_public_summaries: input.summaries,
      reviewed_public_summaries: input.summaries,
      summary_generation_model: input.model,
      summary_prompt_version: input.promptVersion,
      summary_generated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("qa_status", "pending")
    .select("id");
  if (error)
    throw new Error(`一般質問AI要約の保存に失敗した: ${error.message}`);
  if (data.length !== 1) throw new Error("対象は既に確認済みか、存在しません");
}
