import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("prevent_ingestion_audit_mutation()", () => {
  it("監査履歴のUPDATEとDELETEを拒否する", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare source_id uuid; version_id uuid; transition_id uuid;
      begin
        insert into public.ingestion_sources (source, url)
        values ('audit_test', 'https://example.com/source/' || gen_random_uuid())
        returning id into source_id;
        insert into public.ingestion_source_versions (
          ingestion_source_id, content_hash, fetched_at
        ) values (source_id, 'sha256:' || gen_random_uuid(), now())
        returning id into version_id;
        insert into public.ingestion_source_version_retention_transitions (
          source_version_id, from_state, to_state, changed_by, reason
        ) values (
          version_id, 'pending', 'expired', gen_random_uuid(), 'test'
        ) returning id into transition_id;

        begin
          update public.ingestion_source_version_retention_transitions
          set reason = 'changed' where id = transition_id;
          raise exception 'audit update unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%append-only%' then raise; end if;
        end;
        begin
          delete from public.ingestion_source_version_retention_transitions
          where id = transition_id;
          raise exception 'audit delete unexpectedly succeeded';
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
