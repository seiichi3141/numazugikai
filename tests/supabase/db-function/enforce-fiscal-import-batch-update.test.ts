import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_fiscal_import_batch_update()", () => {
  it("runningバッチは完了日時を設定して確認待ちへ進められる", () => {
    const output = executeInTestDatabase(`
      begin;
      insert into public.ingestion_sources (id, source, url) values (
        '21000000-0000-0000-0000-000000000011',
        'fiscal_test', 'https://example.com/fiscal-running.pdf'
      );
      insert into public.ingestion_source_versions (
        id, ingestion_source_id, content_hash, fetched_at
      ) values (
        '21000000-0000-0000-0000-000000000012',
        '21000000-0000-0000-0000-000000000011', 'hash', now()
      );
      insert into public.ingestion_runs (id, source) values (
        '21000000-0000-0000-0000-000000000013', 'fiscal_test'
      );
      insert into public.ingestion_parse_runs (
        id, ingestion_run_id, source_version_id, parser_name,
        parser_version, configuration_hash
      ) values (
        '21000000-0000-0000-0000-000000000014',
        '21000000-0000-0000-0000-000000000013',
        '21000000-0000-0000-0000-000000000012',
        'fixture', '1', 'config'
      );
      insert into public.fiscal_import_batches (
        id, parse_run_id, source_version_id, source_kind,
        profile_key, profile_version
      ) values (
        '21000000-0000-0000-0000-000000000015',
        '21000000-0000-0000-0000-000000000014',
        '21000000-0000-0000-0000-000000000012',
        'budget_overview', 'fixture', '1'
      );
      update public.fiscal_import_batches
      set status = 'awaiting_review', finished_at = now();
      rollback;
    `);

    expect(output).toContain("ROLLBACK");
  });

  it("parser結果の改変と状態の巻き戻しを拒否する", () => {
    const output = executeInTestDatabase(`
      begin;
      insert into public.ingestion_sources (id, source, url) values (
        '21000000-0000-0000-0000-000000000001',
        'fiscal_test', 'https://example.com/fiscal-batch.pdf'
      );
      insert into public.ingestion_source_versions (
        id, ingestion_source_id, content_hash, fetched_at
      ) values (
        '21000000-0000-0000-0000-000000000002',
        '21000000-0000-0000-0000-000000000001', 'hash', now()
      );
      insert into public.ingestion_runs (id, source) values (
        '21000000-0000-0000-0000-000000000003', 'fiscal_test'
      );
      insert into public.ingestion_parse_runs (
        id, ingestion_run_id, source_version_id, parser_name,
        parser_version, configuration_hash
      ) values (
        '21000000-0000-0000-0000-000000000004',
        '21000000-0000-0000-0000-000000000003',
        '21000000-0000-0000-0000-000000000002',
        'fixture', '1', 'config'
      );
      insert into public.fiscal_import_batches (
        id, parse_run_id, source_version_id, source_kind,
        profile_key, profile_version, status, finished_at
      ) values (
        '21000000-0000-0000-0000-000000000005',
        '21000000-0000-0000-0000-000000000004',
        '21000000-0000-0000-0000-000000000002',
        'budget_overview', 'fixture', '1', 'awaiting_review', now()
      );
      update public.fiscal_import_batches set status = 'approved';
      do $block$
      begin
        begin
          update public.fiscal_import_batches set staged_count = 99;
          raise exception 'parser result mutation unexpectedly succeeded';
        exception when raise_exception then
          if sqlerrm not like '%parser result is immutable%' then raise; end if;
        end;
        begin
          update public.fiscal_import_batches set status = 'awaiting_review';
          raise exception 'status rollback unexpectedly succeeded';
        exception when raise_exception then
          if sqlerrm not like '%invalid fiscal import batch status%' then raise; end if;
        end;
      end;
      $block$;
      rollback;
    `);

    expect(output).toContain("ROLLBACK");
  });
});
