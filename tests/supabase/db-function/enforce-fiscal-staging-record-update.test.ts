import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_fiscal_staging_record_update()", () => {
  it("QA情報だけを一度更新でき、parser出力は改変できない", () => {
    const output = executeInTestDatabase(`
      begin;
      insert into public.ingestion_sources (id, source, url) values (
        '22000000-0000-0000-0000-000000000001',
        'fiscal_test', 'https://example.com/fiscal-record.pdf'
      );
      insert into public.ingestion_source_versions (
        id, ingestion_source_id, content_hash, fetched_at
      ) values (
        '22000000-0000-0000-0000-000000000002',
        '22000000-0000-0000-0000-000000000001', 'hash', now()
      );
      insert into public.ingestion_runs (id, source) values (
        '22000000-0000-0000-0000-000000000003', 'fiscal_test'
      );
      insert into public.ingestion_parse_runs (
        id, ingestion_run_id, source_version_id, parser_name,
        parser_version, configuration_hash
      ) values (
        '22000000-0000-0000-0000-000000000004',
        '22000000-0000-0000-0000-000000000003',
        '22000000-0000-0000-0000-000000000002',
        'fixture', '1', 'config'
      );
      insert into public.fiscal_import_batches (
        id, parse_run_id, source_version_id, source_kind,
        profile_key, profile_version, status, finished_at
      ) values (
        '22000000-0000-0000-0000-000000000005',
        '22000000-0000-0000-0000-000000000004',
        '22000000-0000-0000-0000-000000000002',
        'budget_overview', 'fixture', '1', 'awaiting_review', now()
      );
      insert into public.fiscal_staging_records (
        id, batch_id, record_kind, source_record_key,
        content_fingerprint, change_kind, parsed_payload
      ) values (
        '22000000-0000-0000-0000-000000000006',
        '22000000-0000-0000-0000-000000000005',
        'amount', 'amount-1', 'fingerprint', 'new', '{"amountYen":"0"}'
      );
      do $block$
      begin
        begin
          update public.fiscal_staging_records
          set parsed_payload = '{"amountYen":"1"}';
          raise exception 'parser output mutation unexpectedly succeeded';
        exception when raise_exception then
          if sqlerrm not like '%staged parser output is immutable%' then raise; end if;
        end;
      end;
      $block$;
      update public.fiscal_staging_records
      set qa_status = 'verified', review_note = '原資料と一致',
        reviewed_by = '22000000-0000-0000-0000-000000000099',
        reviewed_at = now();
      do $block$
      begin
        begin
          update public.fiscal_staging_records set review_note = '再編集';
          raise exception 'reviewed record mutation unexpectedly succeeded';
        exception when raise_exception then
          if sqlerrm not like '%reviewed fiscal staging record is immutable%' then raise; end if;
        end;
      end;
      $block$;
      rollback;
    `);

    expect(output).toContain("ROLLBACK");
  });
});
