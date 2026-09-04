import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

const stagingParserFixtureSql = `
  insert into public.ingestion_sources (id, source, url)
  values (
    '00000000-0000-0000-0000-000000000101',
    'general_question_pdf',
    'https://example.com/staging-fixture.pdf'
  );
  insert into public.ingestion_source_versions (
    id, ingestion_source_id, content_hash, fetched_at
  ) values (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000101',
    'sha256:staging-fixture',
    now()
  );
  insert into public.ingestion_runs (id, source)
  values (
    '00000000-0000-0000-0000-000000000103',
    'general_question_pdf'
  );
  insert into public.ingestion_parse_runs (
    id, ingestion_run_id, source_version_id, parser_name,
    parser_version, configuration_hash
  ) values (
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000102',
    'staging-fixture-parser',
    '1.0.0',
    'sha256:staging-fixture-config'
  );
`;

const saveCall = `public.save_general_question_staging(
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000104',
  '[{
    "source_appearance_key":"appearance-1",
    "content_fingerprint":"hash-1",
    "change_kind":"new",
    "matched_appearance_id":null,
    "parsed_payload":{"speakerName":"テスト議員"}
  }]'::jsonb,
  1,
  '[]'::jsonb,
  'completed',
  now(),
  null
)`;

describe("save_general_question_staging()", () => {
  it("バッチ・staging行・解析完了を1回の呼出しで保存する", () => {
    const output = executeInTestDatabase(`
      begin;
      ${stagingParserFixtureSql}
      select ${saveCall};
      do $block$
      begin
        if (select status from public.general_question_import_batches)
            <> 'awaiting_review'
          or (select count(*) from public.general_question_staging_appearances)
            <> 1
          or (select status from public.ingestion_parse_runs
                where id = '00000000-0000-0000-0000-000000000104')
            <> 'completed' then
          raise exception 'atomic staging save did not persist all results';
        end if;
      end;
      $block$;
      rollback;
    `);

    expect(output).toContain("ROLLBACK");
  });

  it("staging挿入失敗時はバッチ作成と解析完了もロールバックする", () => {
    const output = executeInTestDatabase(`
      begin;
      ${stagingParserFixtureSql}
      do $block$
      begin
        perform public.save_general_question_staging(
          '00000000-0000-0000-0000-000000000102',
          '00000000-0000-0000-0000-000000000104',
          '[
            {"source_appearance_key":"duplicate","content_fingerprint":"a","change_kind":"new","matched_appearance_id":null,"parsed_payload":{}},
            {"source_appearance_key":"duplicate","content_fingerprint":"b","change_kind":"new","matched_appearance_id":null,"parsed_payload":{}}
          ]'::jsonb,
          2,
          '[]'::jsonb,
          'completed',
          now(),
          null
        );
        raise exception 'expected unique violation';
      exception
        when unique_violation then null;
      end;
      $block$;
      do $block$
      begin
        if (select count(*) from public.general_question_import_batches) <> 0
          or (select count(*) from public.general_question_staging_appearances)
            <> 0
          or (select status from public.ingestion_parse_runs
                where id = '00000000-0000-0000-0000-000000000104')
            <> 'running' then
          raise exception 'failed staging save was not rolled back';
        end if;
      end;
      $block$;
      rollback;
    `);

    expect(output).toContain("ROLLBACK");
  });
});
