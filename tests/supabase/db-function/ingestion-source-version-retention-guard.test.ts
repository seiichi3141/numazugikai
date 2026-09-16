import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("ingestion_source_version_retention_guard()", () => {
  it("active参照がある原本の保持終了を拒否し、release後は許可する", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare source_id uuid; version_id uuid; reference_id uuid;
      begin
        insert into public.ingestion_sources (source, url)
        values ('audit_test', 'https://example.com/source/' || gen_random_uuid())
        returning id into source_id;
        insert into public.ingestion_source_versions (
          ingestion_source_id, content_hash, fetched_at
        ) values (source_id, 'sha256:' || gen_random_uuid(), now())
        returning id into version_id;
        perform public.transition_ingestion_source_version_retention(
          version_id,
          'retained',
          gen_random_uuid(),
          'test setup',
          'test/' || version_id,
          null
        );
        insert into public.source_artifact_consumer_types (
          consumer_type, description, registered_by_migration
        ) values ('test:retention_guard', 'test', 'test');
        insert into public.published_source_version_references (
          consumer_type, consumer_id, evidence_table, evidence_id,
          source_version_id
        ) values (
          'test:retention_guard', gen_random_uuid(), 'test_evidence',
          gen_random_uuid(), version_id
        ) returning id into reference_id;

        begin
          update public.ingestion_source_versions
          set artifact_retention_state = 'expired', private_object_key = null
          where id = version_id;
          set constraints ingestion_source_version_retention_is_referenced immediate;
          raise exception 'retention end unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%requires the retained artifact%' then raise; end if;
        end;

        update public.published_source_version_references
        set released_at = now() where id = reference_id;
        update public.ingestion_source_versions
        set artifact_retention_state = 'expired', private_object_key = null
        where id = version_id;
        set constraints ingestion_source_version_retention_is_referenced immediate;
      end;
      $$;
      select 'ok';
      rollback;
    `);
    expect(result).toContain("ROLLBACK");
  });
});
