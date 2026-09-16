import { describe, expect, it } from "vitest";
import { councilMeetingParserFixtureSql } from "./council-meeting-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_general_question_staging_update()", () => {
  it("未確認行には開催日のQA補正を記録できる", () => {
    const output =
      executeInTestDatabase(`begin; ${councilMeetingParserFixtureSql}
      insert into public.general_question_import_batches (
        id, parse_run_id, source_version_id
      ) values (
        '00000000-0000-0000-0000-000000000501',
        '00000000-0000-0000-0000-000000000104',
        '00000000-0000-0000-0000-000000000102'
      );
      insert into public.general_question_staging_appearances (
        id, batch_id, source_appearance_key, content_fingerprint,
        change_kind, parsed_payload
      ) values (
        '00000000-0000-0000-0000-000000000502',
        '00000000-0000-0000-0000-000000000501',
        'appearance-1', 'hash', 'new', '{}'::jsonb
      );
      update public.general_question_staging_appearances
      set reviewed_held_on = '2026-09-04'
      where id = '00000000-0000-0000-0000-000000000502'; rollback;`);
    expect(output).toContain("ROLLBACK");
  });

  it("parser出力を直接変更できない", () => {
    expect(() =>
      executeInTestDatabase(`begin; ${councilMeetingParserFixtureSql}
        insert into public.general_question_import_batches (
          id, parse_run_id, source_version_id
        ) values (
          '00000000-0000-0000-0000-000000000501',
          '00000000-0000-0000-0000-000000000104',
          '00000000-0000-0000-0000-000000000102'
        );
        insert into public.general_question_staging_appearances (
          id, batch_id, source_appearance_key, content_fingerprint,
          change_kind, parsed_payload
        ) values (
          '00000000-0000-0000-0000-000000000502',
          '00000000-0000-0000-0000-000000000501',
          'appearance-1', 'hash', 'new', '{}'::jsonb
        );
        update public.general_question_staging_appearances
        set parsed_payload = '{"speakerName":"changed"}'::jsonb
        where id = '00000000-0000-0000-0000-000000000502'; rollback;`)
    ).toThrow(/staged parser output is immutable/);
  });

  it("未確認行にはAI生成要約と人手確認用要約を記録できる", () => {
    const output =
      executeInTestDatabase(`begin; ${councilMeetingParserFixtureSql}
      insert into public.general_question_import_batches (
        id, parse_run_id, source_version_id
      ) values (
        '00000000-0000-0000-0000-000000000501',
        '00000000-0000-0000-0000-000000000104',
        '00000000-0000-0000-0000-000000000102'
      );
      insert into public.general_question_staging_appearances (
        id, batch_id, source_appearance_key, content_fingerprint,
        change_kind, parsed_payload
      ) values (
        '00000000-0000-0000-0000-000000000502',
        '00000000-0000-0000-0000-000000000501',
        'appearance-1', 'hash', 'new', '{}'::jsonb
      );
      update public.general_question_staging_appearances set
        generated_public_summaries = '{"item-1":"AI要約"}'::jsonb,
        reviewed_public_summaries = '{"item-1":"確認済み要約"}'::jsonb,
        summary_generation_model = 'openai/gpt-5-mini',
        summary_prompt_version = '2026-09-04-v1',
        summary_generated_at = now()
      where id = '00000000-0000-0000-0000-000000000502'; rollback;`);
    expect(output).toContain("ROLLBACK");
  });
});
