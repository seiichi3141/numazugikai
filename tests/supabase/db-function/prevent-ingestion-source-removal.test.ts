import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("prevent_ingestion_source_removal()", () => {
  it("取得元のDELETEとTRUNCATEを拒否する", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare source_id uuid;
      begin
        insert into public.ingestion_sources (source, url)
        values ('audit_test', 'https://example.com/source/' || gen_random_uuid())
        returning id into source_id;

        begin
          delete from public.ingestion_sources where id = source_id;
          raise exception 'delete unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%append-only%' then raise; end if;
        end;

        begin
          truncate public.ingestion_sources cascade;
          raise exception 'truncate unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%append-only%' then raise; end if;
        end;
      end;
      $$;
      select 'ok';
      rollback;
    `);
    expect(result).toContain("ROLLBACK");
  });
});
