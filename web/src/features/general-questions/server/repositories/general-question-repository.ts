import "server-only";
import { createAdminClient } from "@mirai-gikai/supabase";
import type {
  GeneralQuestionAppearance,
  GeneralQuestionCoverage,
  GeneralQuestionSession,
} from "../../shared/types/general-question";
import { prioritizePrimaryEvidence } from "../../shared/utils/prioritize-primary-evidence";
import { sortQuestionItems } from "../../shared/utils/sort-question-items";

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type ClassifiedTopicRow = {
  classification_set_id: string;
  policy_topic_id: string;
  policy_topics: { slug: string; label: string } | null;
};

const PAGE_SIZE = 1000;
const FILTER_CHUNK_SIZE = 200;

function appendMapValue<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key);
  if (values) {
    values.push(value);
  } else {
    map.set(key, [value]);
  }
}

async function fetchAllRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<PageResult<T>> {
  const data: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await loadPage(from, from + PAGE_SIZE - 1);
    if (result.error) return { data: null, error: result.error };
    const page = result.data ?? [];
    data.push(...page);
    if (page.length < PAGE_SIZE) return { data, error: null };
  }
}

async function fetchRowsByIdChunks<T>(
  ids: string[],
  loadPage: (
    chunk: string[],
    from: number,
    to: number
  ) => PromiseLike<PageResult<T>>
): Promise<PageResult<T>> {
  const data: T[] = [];
  const uniqueIds = [...new Set(ids)];
  for (let offset = 0; offset < uniqueIds.length; offset += FILTER_CHUNK_SIZE) {
    const chunk = uniqueIds.slice(offset, offset + FILTER_CHUNK_SIZE);
    const result = await fetchAllRows((from, to) => loadPage(chunk, from, to));
    if (result.error) return result;
    data.push(...(result.data ?? []));
  }
  return { data, error: null };
}

export async function findPublishedGeneralQuestionSessions(): Promise<
  GeneralQuestionSession[]
>;
export async function findPublishedGeneralQuestionSessions(options: {
  appearanceIds: string[];
}): Promise<GeneralQuestionSession[]>;
export async function findPublishedGeneralQuestionSessions(options?: {
  appearanceIds: string[];
}): Promise<GeneralQuestionSession[]> {
  const supabase = createAdminClient();
  const appearanceIds = options?.appearanceIds;
  const [
    sessionsResult,
    meetingsResult,
    appearancesResult,
    itemsResult,
    answerersResult,
    coverageTargetsResult,
    coverageResult,
    appearanceSourcesResult,
  ] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("council_sessions")
        .select("id, name, slug, start_date, end_date")
        .not("slug", "is", null)
        .order("start_date", { ascending: false })
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("council_meeting_revisions")
        .select(
          "id, meeting_id, council_session_id, held_on, scheduled_on, status, display_title"
        )
        .eq("qa_status", "verified")
        .eq("publication_state", "published")
        .eq("kind", "plenary")
        .in("status", ["scheduled", "held"])
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      (appearanceIds?.length
        ? supabase
            .from("general_question_appearance_revisions")
            .select(
              "id, appearance_id, meeting_id, speaker_display_name, seat_number, question_order, question_kind, delivery_method"
            )
            .eq("qa_status", "verified")
            .eq("publication_state", "published")
            .in("appearance_id", appearanceIds)
        : supabase
            .from("general_question_appearance_revisions")
            .select(
              "id, appearance_id, meeting_id, speaker_display_name, seat_number, question_order, question_kind, delivery_method"
            )
            .eq("qa_status", "verified")
            .eq("publication_state", "published")
      ).range(from, to)
    ),
    fetchAllRows((from, to) =>
      (appearanceIds?.length
        ? supabase
            .from("general_question_item_revisions")
            .select(
              "id, question_item_id, appearance_id, parent_item_id, item_order, public_summary"
            )
            .eq("qa_status", "verified")
            .eq("publication_state", "published")
            .in("appearance_id", appearanceIds)
        : supabase
            .from("general_question_item_revisions")
            .select(
              "id, question_item_id, appearance_id, parent_item_id, item_order, public_summary"
            )
            .eq("qa_status", "verified")
            .eq("publication_state", "published")
      ).range(from, to)
    ),
    fetchAllRows((from, to) =>
      (appearanceIds?.length
        ? supabase
            .from("general_question_answerer_revisions")
            .select(
              "id, answerer_id, appearance_id, person_display_name, role_display_name, role_group, display_order"
            )
            .eq("qa_status", "verified")
            .eq("publication_state", "published")
            .in("appearance_id", appearanceIds)
        : supabase
            .from("general_question_answerer_revisions")
            .select(
              "id, answerer_id, appearance_id, person_display_name, role_display_name, role_group, display_order"
            )
            .eq("qa_status", "verified")
            .eq("publication_state", "published")
      ).range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("general_question_session_coverage")
        .select("id, council_session_id, source_kind")
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("general_question_session_coverage_observations")
        .select(
          "coverage_id, state, record_presence, session_disposition, expected_count, matched_count, checked_at"
        )
        .eq("qa_status", "verified")
        .eq("publication_state", "published")
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      (appearanceIds?.length
        ? supabase
            .from("general_question_appearance_sources")
            .select(
              "id, appearance_revision_id, ingestion_source_id, source_version_id, role"
            )
            .eq("qa_status", "verified")
            .in("appearance_id", appearanceIds)
        : supabase
            .from("general_question_appearance_sources")
            .select(
              "id, appearance_revision_id, ingestion_source_id, source_version_id, role"
            )
            .eq("qa_status", "verified")
      ).range(from, to)
    ),
  ]);
  const failed = [
    sessionsResult,
    meetingsResult,
    appearancesResult,
    itemsResult,
    answerersResult,
    coverageTargetsResult,
    coverageResult,
    appearanceSourcesResult,
  ].find((result) => result.error);
  if (failed?.error)
    throw new Error(
      `一般質問公開データの取得に失敗した: ${failed.error.message}`
    );

  const appearanceSourceRows = appearanceSourcesResult.data ?? [];
  const [sourcesResult, sourceVersionsResult] = await Promise.all([
    fetchRowsByIdChunks(
      appearanceSourceRows.map((row) => row.ingestion_source_id),
      (ids, from, to) =>
        supabase
          .from("ingestion_sources")
          .select("id, url")
          .in("id", ids)
          .range(from, to)
    ),
    fetchRowsByIdChunks(
      appearanceSourceRows.map((row) => row.source_version_id),
      (ids, from, to) =>
        supabase
          .from("ingestion_source_versions")
          .select("id, fetched_at")
          .in("id", ids)
          .range(from, to)
    ),
  ]);
  if (sourcesResult.error || sourceVersionsResult.error) {
    throw new Error("一般質問の出典情報取得に失敗した");
  }

  const { data: release, error: releaseError } = await supabase
    .from("topic_classification_releases")
    .select("id, taxonomy_id")
    .eq("consumer_type", "general_question_item")
    .eq("qa_status", "verified")
    .eq("publication_state", "published")
    .maybeSingle();
  if (releaseError) {
    throw new Error(
      `一般質問分類releaseの取得に失敗した: ${releaseError.message}`
    );
  }
  const topicsByItemRevision = new Map<
    string,
    Array<{ id: string; slug: string; label: string }>
  >();
  let taxonomyVersion: string | null = null;
  if (release) {
    const [releaseItemsResult, taxonomyResult] = await Promise.all([
      fetchAllRows((from, to) =>
        supabase
          .from("general_question_classification_release_items")
          .select("question_item_revision_id, classification_set_id")
          .eq("release_id", release.id)
          .eq("coverage_disposition", "classified")
          .range(from, to)
      ),
      supabase
        .from("policy_taxonomies")
        .select("version")
        .eq("id", release.taxonomy_id)
        .eq("publication_state", "published")
        .maybeSingle(),
    ]);
    if (releaseItemsResult.error || taxonomyResult.error) {
      throw new Error("一般質問の公開分類データ取得に失敗した");
    }
    taxonomyVersion = taxonomyResult.data?.version ?? null;
    const setIds = (releaseItemsResult.data ?? [])
      .map((row) => row.classification_set_id)
      .filter((id): id is string => id !== null);
    if (setIds.length > 0) {
      const classifiedTopics: ClassifiedTopicRow[] = [];
      for (
        let offset = 0;
        offset < setIds.length;
        offset += FILTER_CHUNK_SIZE
      ) {
        const chunk = setIds.slice(offset, offset + FILTER_CHUNK_SIZE);
        const result = await fetchAllRows((from, to) =>
          supabase
            .from("general_question_item_topics")
            .select(
              "classification_set_id, policy_topic_id, policy_topics(slug, label)"
            )
            .in("classification_set_id", chunk)
            .range(from, to)
        );
        if (result.error) {
          throw new Error(`政策分野の取得に失敗した: ${result.error.message}`);
        }
        classifiedTopics.push(...(result.data ?? []));
      }
      const itemRevisionBySet = new Map(
        (releaseItemsResult.data ?? [])
          .filter((row) => row.classification_set_id !== null)
          .map((row) => [
            row.classification_set_id as string,
            row.question_item_revision_id,
          ])
      );
      for (const row of classifiedTopics) {
        const itemRevisionId = itemRevisionBySet.get(row.classification_set_id);
        const topic = row.policy_topics;
        if (!itemRevisionId || !topic) continue;
        appendMapValue(topicsByItemRevision, itemRevisionId, {
          id: row.policy_topic_id,
          slug: topic.slug,
          label: topic.label,
        });
      }
    }
  }

  const meetings = new Map(
    (meetingsResult.data ?? []).map((row) => [row.meeting_id, row])
  );
  const itemsByAppearance = new Map<
    string,
    NonNullable<typeof itemsResult.data>
  >();
  for (const row of itemsResult.data ?? []) {
    appendMapValue(itemsByAppearance, row.appearance_id, row);
  }
  const answerersByAppearance = new Map<
    string,
    NonNullable<typeof answerersResult.data>
  >();
  for (const row of answerersResult.data ?? []) {
    appendMapValue(answerersByAppearance, row.appearance_id, row);
  }
  const sourceById = new Map(
    (sourcesResult.data ?? []).map((row) => [row.id, row])
  );
  const sourceVersionById = new Map(
    (sourceVersionsResult.data ?? []).map((row) => [row.id, row])
  );
  const evidenceByRevision = new Map<
    string,
    { url: string; fetchedAt: string | null }
  >();
  const prioritizedEvidence = prioritizePrimaryEvidence(appearanceSourceRows);
  for (const evidence of prioritizedEvidence) {
    const source = sourceById.get(evidence.ingestion_source_id);
    const sourceVersion = evidence.source_version_id
      ? sourceVersionById.get(evidence.source_version_id)
      : null;
    if (source && !evidenceByRevision.has(evidence.appearance_revision_id)) {
      evidenceByRevision.set(evidence.appearance_revision_id, {
        url: source.url,
        fetchedAt: sourceVersion?.fetched_at ?? null,
      });
    }
  }

  const appearancesBySession = new Map<string, GeneralQuestionAppearance[]>();
  for (const row of appearancesResult.data ?? []) {
    const meeting = meetings.get(row.meeting_id);
    if (!meeting?.council_session_id) continue;
    const evidence = evidenceByRevision.get(row.id);
    const appearance: GeneralQuestionAppearance = {
      id: row.appearance_id,
      meetingId: row.meeting_id,
      heldOn: meeting.held_on ?? meeting.scheduled_on,
      meetingStatus: meeting.status,
      meetingTitle: meeting.display_title,
      speakerName: row.speaker_display_name,
      seatNumber: row.seat_number,
      questionOrder: row.question_order,
      questionKind: row.question_kind,
      deliveryMethod: row.delivery_method,
      items: sortQuestionItems(
        (itemsByAppearance.get(row.appearance_id) ?? []).map((item) => ({
          id: item.question_item_id,
          parentItemId: item.parent_item_id,
          order: item.item_order,
          summary: item.public_summary,
          topics: topicsByItemRevision.get(item.id) ?? [],
        }))
      ),
      answerers: (answerersByAppearance.get(row.appearance_id) ?? [])
        .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
        .map((answerer) => ({
          id: answerer.answerer_id,
          personName: answerer.person_display_name,
          roleName: answerer.role_display_name,
          roleGroup: answerer.role_group,
        })),
      sourceUrl: evidence?.url ?? null,
      sourceFetchedAt: evidence?.fetchedAt ?? null,
    };
    appendMapValue(
      appearancesBySession,
      meeting.council_session_id,
      appearance
    );
  }

  const coverageTargetById = new Map(
    (coverageTargetsResult.data ?? []).map((row) => [
      row.id,
      { sessionId: row.council_session_id, sourceKind: row.source_kind },
    ])
  );
  const coverageBySession = new Map<string, GeneralQuestionCoverage[]>();
  for (const row of coverageResult.data ?? []) {
    const target = coverageTargetById.get(row.coverage_id);
    if (!target) continue;
    appendMapValue(coverageBySession, target.sessionId, {
      sourceKind: target.sourceKind,
      state: row.state,
      recordPresence: row.record_presence,
      disposition: row.session_disposition,
      expectedCount: row.expected_count,
      matchedCount: row.matched_count,
      checkedAt: row.checked_at,
    });
  }

  return (sessionsResult.data ?? []).flatMap((session) => {
    const appearances = appearancesBySession.get(session.id) ?? [];
    const coverage = coverageBySession.get(session.id) ?? [];
    if (
      appearances.length === 0 &&
      (appearanceIds !== undefined || coverage.length === 0)
    )
      return [];
    return [
      {
        id: session.id,
        name: session.name,
        slug: session.slug as string,
        startDate: session.start_date,
        endDate: session.end_date,
        appearances: appearances.sort(
          (a, b) =>
            (a.heldOn ?? "").localeCompare(b.heldOn ?? "") ||
            (a.questionOrder ?? 999) - (b.questionOrder ?? 999)
        ),
        coverage: coverage.sort((a, b) =>
          a.sourceKind.localeCompare(b.sourceKind)
        ),
        classificationRelease:
          release && taxonomyVersion
            ? { id: release.id, taxonomyVersion }
            : null,
      },
    ];
  });
}

export async function findPublishedGeneralQuestionSessionBySlug(slug: string) {
  const sessions = await findPublishedGeneralQuestionSessions();
  return sessions.find((session) => session.slug === slug) ?? null;
}
