import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_ingestion_source_version_identity_update()", () => {
  it("取得版の内容識別列を更新できない", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare source_id uuid; version_id uuid;
      begin
        insert into public.ingestion_sources (source, url)
        values ('audit_test', 'https://example.com/source/' || gen_random_uuid())
        returning id into source_id;
        insert into public.ingestion_source_versions (
          ingestion_source_id, content_hash, fetched_at
        ) values (source_id, 'sha256:' || gen_random_uuid(), now())
        returning id into version_id;

        begin
          update public.ingestion_source_versions
          set content_hash = 'sha256:changed'
          where id = version_id;
          raise exception 'identity update unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%identity is immutable%' then raise; end if;
        end;
      end;
      $$;
      select 'ok';
      rollback;
    `);
    expect(result).toContain("ROLLBACK");
  });
});
