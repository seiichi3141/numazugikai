import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_ingestion_source_version_insert()", () => {
  it("取得版をretainedとして直接作成できない", () => {
    const output = executeInTestDatabase(`
      begin;
      insert into public.ingestion_sources (source, url)
      values ('insert_guard_test', 'https://example.com/insert-guard.pdf');

      do $test$
      begin
        begin
          insert into public.ingestion_source_versions (
            ingestion_source_id,
            content_hash,
            fetched_at,
            artifact_retention_state,
            private_object_key
          )
          select
            id,
            'sha256:insert-guard',
            now(),
            'retained',
            'general-questions/insert-guard.pdf'
          from public.ingestion_sources
          where source = 'insert_guard_test';
          raise exception 'expected insert guard to reject retained state';
        exception
          when others then
            if sqlerrm not like '%must be inserted with pending retention%' then
              raise;
            end if;
        end;
      end
      $test$;
      rollback;
    `);

    expect(output).toContain("ROLLBACK");
  });
});
