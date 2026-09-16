import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_ingestion_parse_run_update()", () => {
  it("runningから一度だけ終端状態へ遷移できる", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare source_id uuid; version_id uuid; run_id uuid; parse_id uuid;
      begin
        insert into public.ingestion_sources (source, url)
        values ('audit_test', 'https://example.com/source/' || gen_random_uuid())
        returning id into source_id;
        insert into public.ingestion_source_versions (
          ingestion_source_id, content_hash, fetched_at
        ) values (source_id, 'sha256:' || gen_random_uuid(), now())
        returning id into version_id;
        insert into public.ingestion_runs (source) values ('audit_test')
        returning id into run_id;
        insert into public.ingestion_parse_runs (
          ingestion_run_id, source_version_id, parser_name, parser_version,
          configuration_hash
        ) values (
          run_id, version_id, 'test', 'v1', gen_random_uuid()::text
        ) returning id into parse_id;

        update public.ingestion_parse_runs
        set status = 'completed', finished_at = now(), parse_stats = '{}'::jsonb
        where id = parse_id;
        begin
          update public.ingestion_parse_runs
          set parse_stats = '{"changed":true}'::jsonb where id = parse_id;
          raise exception 'terminal update unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%terminal parse run is immutable%' then raise; end if;
        end;
      end;
      $$;
      select 'ok';
      rollback;
    `);
    expect(result).toContain("ROLLBACK");
  });
});
