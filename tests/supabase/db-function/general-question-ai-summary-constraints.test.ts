import { describe, expect, it } from "vitest";
import { councilMeetingParserFixtureSql } from "./council-meeting-test-fixture";
import { generalQuestionAppearanceFixtureSql } from "./general-question-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("一般質問AI要約のDB制約", () => {
  it("AI要約に必要な明示制約を持つ", () => {
    const output = executeInTestDatabase(`
      select conname
      from pg_catalog.pg_constraint
      where conrelid in (
        'public.general_question_item_revisions'::regclass,
        'public.general_question_staging_appearances'::regclass
      )
        and conname in (
          'general_question_item_public_summary_check',
          'general_question_item_summary_generation_model_check',
          'general_question_item_summary_prompt_version_check',
          'general_question_staging_generated_summaries_check',
          'general_question_staging_reviewed_summaries_check',
          'general_question_staging_summary_metadata_check'
        )
      order by conname;
    `);

    expect(output.split("\n").map((line) => line.trim())).toEqual([
      "general_question_item_public_summary_check",
      "general_question_item_summary_generation_model_check",
      "general_question_item_summary_prompt_version_check",
      "general_question_staging_generated_summaries_check",
      "general_question_staging_reviewed_summaries_check",
      "general_question_staging_summary_metadata_check",
    ]);
  });

  it("120文字を超える公開要約を拒否する", () => {
    expect(() =>
      executeInTestDatabase(`begin;
        ${generalQuestionAppearanceFixtureSql}
        insert into public.general_question_items (id, appearance_id, item_key)
        values (
          '00000000-0000-0000-0000-000000000311',
          '00000000-0000-0000-0000-000000000201',
          'too-long'
        );
        insert into public.general_question_item_revisions (
          question_item_id, appearance_id, revision_number, public_summary,
          summary_generation_model, summary_prompt_version
        ) values (
          '00000000-0000-0000-0000-000000000311',
          '00000000-0000-0000-0000-000000000201',
          1, repeat('要', 121), 'openai/gpt-5-mini', '2026-09-04-v1'
        );
        rollback;
      `)
    ).toThrow(/general_question_item_public_summary_check/);
  });

  it("空の生成モデルまたはプロンプト版を拒否する", () => {
    expect(() =>
      executeInTestDatabase(`begin;
        ${councilMeetingParserFixtureSql}
        insert into public.general_question_import_batches (
          id, parse_run_id, source_version_id
        ) values (
          '00000000-0000-0000-0000-000000000501',
          '00000000-0000-0000-0000-000000000104',
          '00000000-0000-0000-0000-000000000102'
        );
        insert into public.general_question_staging_appearances (
          batch_id, source_appearance_key, content_fingerprint, change_kind,
          parsed_payload, summary_generation_model, summary_prompt_version,
          summary_generated_at
        ) values (
          '00000000-0000-0000-0000-000000000501',
          'appearance-1', 'hash', 'new', '{}'::jsonb,
          '', '2026-09-04-v1', now()
        );
        rollback;
      `)
    ).toThrow(/general_question_staging_summary_metadata_check/);
  });
});
