import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

const fiscalStagingFixtureSql = `
  insert into public.ingestion_sources (id, source, url) values (
    '20000000-0000-0000-0000-000000000001',
    'fiscal_budget_overview',
    'https://example.com/fiscal-staging.pdf'
  );
  insert into public.ingestion_source_versions (
    id, ingestion_source_id, content_hash, fetched_at
  ) values (
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'sha256:fiscal-staging', now()
  );
  insert into public.ingestion_runs (id, source) values (
    '20000000-0000-0000-0000-000000000003',
    'fiscal_budget_overview'
  );
  insert into public.ingestion_parse_runs (
    id, ingestion_run_id, source_version_id, parser_name,
    parser_version, configuration_hash
  ) values (
    '20000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000002',
    'fiscal-fixture', '1.0.0', 'sha256:fiscal-config'
  );
`;

const saveCall = `public.save_fiscal_staging(
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000004',
  'budget_overview',
  'budget-overview-fixture',
  '1.0.0',
  2090::smallint,
  '[{
    "record_kind":"amount",
    "source_record_key":"general:expenditure",
    "content_fingerprint":"sha256:amount",
    "change_kind":"new",
    "matched_target_id":null,
    "parsed_payload":{"amountYen":"1000"},
    "validation_results":[{
      "rule_code":"amount_control_total",
      "severity":"hard_error",
      "message":"合計が一致しません"
    }]
  }]'::jsonb,
  1,
  '[{
    "rule_code":"document_title",
    "severity":"warning",
    "message":"表題を確認してください"
  }]'::jsonb,
  'completed',
  now()
)`;

describe("save_fiscal_staging()", () => {
  it("バッチ・候補・検算件数・parse run完了を原子的に保存する", () => {
    const output = executeInTestDatabase(`
      begin;
      ${fiscalStagingFixtureSql}
      select ${saveCall};
      do $block$
      begin
        if (select status from public.fiscal_import_batches)
            <> 'awaiting_review'
          or (select hard_error_count from public.fiscal_import_batches) <> 1
          or (select warning_count from public.fiscal_import_batches) <> 1
          or jsonb_array_length(
            (select validation_summary from public.fiscal_import_batches)
          ) <> 1
          or jsonb_array_length(
            (select validation_messages
             from public.fiscal_import_batch_qa_counts)
          ) <> 2
          or (select count(*) from public.fiscal_staging_records) <> 1
          or (select status from public.ingestion_parse_runs
                where id = '20000000-0000-0000-0000-000000000004')
            <> 'completed' then
          raise exception 'fiscal staging was not saved atomically';
        end if;
      end;
      $block$;
      rollback;
    `);

    expect(output).toContain("ROLLBACK");
  });

  it("候補保存が失敗するとバッチとparse run確定もロールバックする", () => {
    const output = executeInTestDatabase(`
      begin;
      ${fiscalStagingFixtureSql}
      do $block$
      begin
        perform public.save_fiscal_staging(
          '20000000-0000-0000-0000-000000000002',
          '20000000-0000-0000-0000-000000000004',
          'budget_overview', 'duplicate-fixture', '1.0.0', 2090::smallint,
          '[
            {"record_kind":"amount","source_record_key":"duplicate","content_fingerprint":"a","change_kind":"new","matched_target_id":null,"parsed_payload":{},"validation_results":[]},
            {"record_kind":"amount","source_record_key":"duplicate","content_fingerprint":"b","change_kind":"new","matched_target_id":null,"parsed_payload":{},"validation_results":[]}
          ]'::jsonb,
          2, '[]'::jsonb, 'completed', now()
        );
        raise exception 'duplicate staging row unexpectedly succeeded';
      exception
        when unique_violation then null;
      end;
      $block$;
      do $block$
      begin
        if (select count(*) from public.fiscal_import_batches) <> 0
          or (select count(*) from public.fiscal_staging_records) <> 0
          or (select status from public.ingestion_parse_runs
                where id = '20000000-0000-0000-0000-000000000004')
            <> 'running' then
          raise exception 'failed fiscal staging save was not rolled back';
        end if;
      end;
      $block$;
      rollback;
    `);

    expect(output).toContain("ROLLBACK");
  });

  it("service_roleだけに実行権限を与える", () => {
    const output = executeInTestDatabase(`
      select (
        has_function_privilege(
          'service_role',
          'public.save_fiscal_staging(uuid,uuid,fiscal_source_kind_enum,text,text,smallint,jsonb,integer,jsonb,ingestion_parse_status_enum,timestamptz)',
          'execute'
        )::text || '|' ||
        has_function_privilege(
          'anon',
          'public.save_fiscal_staging(uuid,uuid,fiscal_source_kind_enum,text,text,smallint,jsonb,integer,jsonb,ingestion_parse_status_enum,timestamptz)',
          'execute'
        )::text);
    `);

    expect(output).toBe("true|false");
  });
});
