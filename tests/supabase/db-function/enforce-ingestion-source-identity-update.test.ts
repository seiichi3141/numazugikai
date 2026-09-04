import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_ingestion_source_identity_update()", () => {
  it("取得元の識別列を固定し、最新取得メタデータだけ更新できる", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare source_id uuid;
      begin
        insert into public.ingestion_sources (source, url)
        values ('audit_test', 'https://example.com/source/' || gen_random_uuid())
        returning id into source_id;

        begin
          update public.ingestion_sources
          set url = 'https://example.com/changed'
          where id = source_id;
          raise exception 'identity update unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%identity is immutable%' then raise; end if;
        end;

        update public.ingestion_sources
        set content_hash = 'latest-hash', last_fetched_at = now()
        where id = source_id;
      end;
      $$;
      select 'ok';
      rollback;
    `);
    expect(result).toContain("ROLLBACK");
  });
});
