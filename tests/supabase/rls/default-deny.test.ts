import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUser,
  createTestUser,
  getAnonClient,
  getAuthenticatedClient,
} from "../utils";

/**
 * 全テーブルは RLS 有効 + ポリシーなし（default deny）。
 * anon / authenticated どちらからも SELECT・INSERT できないことを確認する。
 */

const tables = [
  "bills",
  "bill_contents",
  "mirai_stances",
  "chats",
  "tags",
  "bills_tags",
  "preview_tokens",
  "council_sessions",
  "interview_configs",
  "interview_questions",
  "interview_sessions",
  "interview_messages",
  "interview_report",
  "ingestion_source_versions",
  "ingestion_parse_runs",
  "ingestion_source_version_retention_transitions",
  "source_artifact_consumer_types",
  "published_source_version_references",
  "council_meetings",
  "council_meeting_revisions",
  "council_meeting_source_occurrences",
  "council_meeting_source_evidence",
  "general_question_appearances",
  "general_question_appearance_revisions",
  "general_question_appearance_source_occurrences",
  "general_question_appearance_sources",
  "general_question_items",
  "general_question_item_revisions",
  "general_question_item_source_occurrences",
  "general_question_item_sources",
  "general_question_answerers",
  "general_question_answerer_revisions",
  "general_question_answerer_source_occurrences",
  "general_question_answerer_sources",
  "general_question_session_coverage",
  "general_question_session_coverage_observations",
  "general_question_session_coverage_source_occurrences",
  "general_question_session_coverage_observation_sources",
  "general_question_import_batches",
  "general_question_staging_appearances",
  "policy_taxonomies",
  "policy_topics",
  "topic_classification_runs",
  "general_question_item_classification_sets",
  "general_question_item_topics",
  "topic_classification_population_snapshots",
  "general_question_classification_population_members",
  "topic_classification_releases",
  "general_question_classification_release_items",
  "fiscal_accounts",
  "fiscal_reporting_scopes",
  "fiscal_reporting_scope_memberships",
  "fiscal_source_documents",
  "fiscal_source_document_editions",
  "fiscal_source_document_edition_source_occurrences",
  "fiscal_reporting_scope_membership_source_occurrences",
  "fiscal_source_document_edition_observations",
  "fiscal_reporting_scope_membership_observations",
  "fiscal_events",
  "fiscal_classifications",
  "fiscal_classification_revisions",
  "fiscal_amount_sets",
  "fiscal_amount_set_revisions",
  "fiscal_amounts",
  "fiscal_amount_revisions",
  "fiscal_amount_set_source_occurrences",
  "fiscal_amount_set_sources",
  "fiscal_amount_source_occurrences",
  "fiscal_amount_evidence",
  "fiscal_event_bill_links",
  "fiscal_event_bill_link_revisions",
  "fiscal_validation_results",
  "fiscal_validation_result_evidence",
  "fiscal_data_coverage",
  "fiscal_data_coverage_source_occurrences",
  "fiscal_data_coverage_observations",
  "fiscal_data_coverage_observation_sources",
  "fiscal_classification_source_occurrences",
  "fiscal_classification_sources",
  "fiscal_classification_mappings",
  "fiscal_classification_mapping_revisions",
  "fiscal_classification_mapping_members",
  "fiscal_classification_mapping_source_occurrences",
  "fiscal_classification_mapping_sources",
  "fiscal_event_bill_link_source_occurrences",
  "fiscal_event_bill_link_sources",
  "fiscal_source_kind_event_rules",
  "fiscal_import_batches",
  "fiscal_staging_records",
] as const;

describe("RLS default deny（全テーブル共通）", () => {
  describe("anon クライアント", () => {
    const anon = getAnonClient();

    for (const table of tables) {
      it(`${table}: SELECT が空結果になる`, async () => {
        const { data, error } = await anon.from(table).select("*").limit(1);
        // RLS で拒否される場合、エラーか空配列が返る
        if (error) {
          expect(error).toBeTruthy();
        } else {
          expect(data).toEqual([]);
        }
      });
    }

    it("bills: INSERT が拒否される", async () => {
      const { error } = await anon.from("bills").insert({
        name: "不正な挿入テスト",
        status: "submitted",
        publish_status: "draft",
      });
      expect(error).not.toBeNull();
    });

    it("council_sessions: INSERT が拒否される", async () => {
      const { error } = await anon.from("council_sessions").insert({
        name: "不正な挿入テスト",
        start_date: "2025-01-01",
        end_date: "2025-06-30",
        slug: "rls-test",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("authenticated クライアント", () => {
    let userId: string;
    let email: string;
    const password = "test-password-123";

    beforeAll(async () => {
      email = `rls-test-${Date.now()}@example.com`;
      const user = await createTestUser(email, password);
      userId = user.id;
    });

    afterAll(async () => {
      await cleanupTestUser(userId);
    });

    for (const table of tables) {
      it(`${table}: SELECT が空結果になる`, async () => {
        const client = await getAuthenticatedClient(email, password);
        const { data, error } = await client.from(table).select("*").limit(1);
        if (error) {
          expect(error).toBeTruthy();
        } else {
          expect(data).toEqual([]);
        }
      });
    }

    it("bills: INSERT が拒否される", async () => {
      const client = await getAuthenticatedClient(email, password);
      const { error } = await client.from("bills").insert({
        name: "不正な挿入テスト",
        status: "submitted",
        publish_status: "draft",
      });
      expect(error).not.toBeNull();
    });

    it("council_sessions: INSERT が拒否される", async () => {
      const client = await getAuthenticatedClient(email, password);
      const { error } = await client.from("council_sessions").insert({
        name: "不正な挿入テスト",
        start_date: "2025-01-01",
        end_date: "2025-06-30",
        slug: "rls-test",
      });
      expect(error).not.toBeNull();
    });
  });
});
