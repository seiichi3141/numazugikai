import "server-only";
import { createAdminClient } from "@mirai-gikai/supabase";
import { findPublishedGeneralQuestionSessions } from "@/features/general-questions/server/repositories/general-question-repository";
import type { OpenDataCursor } from "../../shared/utils/cursor";
import { paginateRows } from "../../shared/utils/paginate";

export type OpenDataGeneralQuestionItem = {
  appearanceId: string;
  meetingId: string;
  session: { id: string; slug: string; name: string };
  heldOn: string | null;
  questionOrder: number | null;
  questionKind: string;
  deliveryMethod: string;
  speakerName: string;
  seatNumber: number | null;
  items: Array<{
    id: string;
    parentItemId: string | null;
    order: number | null;
    summary: string;
    topics: Array<{ id: string; slug: string; label: string }>;
  }>;
  answerers: Array<{
    id: string;
    personName: string;
    roleName: string;
    roleGroup: string;
  }>;
  sourceUrl: string | null;
  sourceFetchedAt: string | null;
  qaStatus: "verified";
  classificationRelease: { id: string; taxonomyVersion: string } | null;
  coverage: Array<{
    sourceKind: string;
    state: string;
    recordPresence: string;
    disposition: string;
  }>;
};

export async function getOpenDataGeneralQuestions(params: {
  limit: number;
  cursor: OpenDataCursor | null;
  session?: string;
  year?: number;
  questionKind?: string;
  topic?: string;
  role?: string;
}): Promise<{
  items: OpenDataGeneralQuestionItem[];
  nextCursor: string | null;
}> {
  const supabase = createAdminClient();
  const { data: candidates, error } = await supabase.rpc(
    "list_published_general_question_appearances",
    {
      p_limit: params.limit + 1,
      p_cursor_at: params.cursor?.createdAt,
      p_cursor_id: params.cursor?.id,
      p_session_slug: params.session,
      p_year: params.year,
      p_question_kind: params.questionKind,
      p_topic_slug: params.topic,
      p_role_group: params.role,
    }
  );
  if (error) {
    throw new Error(`一般質問オープンデータの検索に失敗した: ${error.message}`);
  }
  const { pageRows: pageCandidates, nextCursor } = paginateRows(
    candidates ?? [],
    params.limit,
    (row) => ({ createdAt: row.cursor_at, id: row.appearance_id })
  );
  if (pageCandidates.length === 0) return { items: [], nextCursor };

  const sessions = await findPublishedGeneralQuestionSessions({
    appearanceIds: pageCandidates.map((row) => row.appearance_id),
  });
  const rowsById = new Map(
    sessions
      .flatMap((session) =>
        session.appearances.map((appearance) => ({
          appearanceId: appearance.id,
          meetingId: appearance.meetingId,
          session: { id: session.id, slug: session.slug, name: session.name },
          heldOn: appearance.heldOn,
          questionOrder: appearance.questionOrder,
          questionKind: appearance.questionKind,
          deliveryMethod: appearance.deliveryMethod,
          speakerName: appearance.speakerName,
          seatNumber: appearance.seatNumber,
          items: appearance.items,
          answerers: appearance.answerers,
          sourceUrl: appearance.sourceUrl,
          sourceFetchedAt: appearance.sourceFetchedAt,
          qaStatus: "verified" as const,
          classificationRelease: session.classificationRelease,
          coverage: session.coverage.map((coverage) => ({
            sourceKind: coverage.sourceKind,
            state: coverage.state,
            recordPresence: coverage.recordPresence,
            disposition: coverage.disposition,
          })),
        }))
      )
      .map((row) => [row.appearanceId, row] as const)
  );
  return {
    items: pageCandidates.map((candidate) => {
      const row = rowsById.get(candidate.appearance_id);
      if (!row) {
        throw new Error(
          `一般質問オープンデータの候補を取得できなかった: ${candidate.appearance_id}`
        );
      }
      return row;
    }),
    nextCursor,
  };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function generalQuestionsToCsv(
  items: OpenDataGeneralQuestionItem[]
): string {
  const header = [
    "appearance_id",
    "meeting_id",
    "session_slug",
    "session_name",
    "held_on",
    "question_order",
    "question_kind",
    "delivery_method",
    "speaker_name",
    "seat_number",
    "top_level_items",
    "policy_topics",
    "answerer_roles",
    "source_url",
    "source_fetched_at",
    "qa_status",
    "release_id",
    "taxonomy_version",
    "coverage_states",
    "coverage_source_kinds",
  ];
  const lines = items.map((item) => [
    item.appearanceId,
    item.meetingId,
    item.session.slug,
    item.session.name,
    item.heldOn,
    item.questionOrder,
    item.questionKind,
    item.deliveryMethod,
    item.speakerName,
    item.seatNumber,
    item.items.filter((question) => question.parentItemId === null).length,
    [
      ...new Set(
        item.items.flatMap((question) =>
          question.topics.map((topic) => topic.label)
        )
      ),
    ].join("|"),
    [...new Set(item.answerers.map((answerer) => answerer.roleName))].join("|"),
    item.sourceUrl,
    item.sourceFetchedAt,
    item.qaStatus,
    item.classificationRelease?.id,
    item.classificationRelease?.taxonomyVersion,
    item.coverage.map((coverage) => coverage.state).join("|"),
    item.coverage.map((coverage) => coverage.sourceKind).join("|"),
  ]);
  return `${header.map(csvCell).join(",")}\n${lines.map((line) => line.map(csvCell).join(",")).join("\n")}\n`;
}
