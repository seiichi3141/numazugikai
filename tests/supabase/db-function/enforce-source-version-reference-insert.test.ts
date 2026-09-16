import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_source_version_reference_insert()", () => {
  it("retained原本へのactive参照だけを登録できる", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare source_id uuid; version_id uuid; consumer_id uuid := gen_random_uuid();
      begin
        insert into public.ingestion_sources (source, url)
        values ('audit_test', 'https://example.com/source/' || gen_random_uuid())
        returning id into source_id;
        insert into public.ingestion_source_versions (
          ingestion_source_id, content_hash, fetched_at
        ) values (source_id, 'sha256:' || gen_random_uuid(), now())
        returning id into version_id;
        insert into public.source_artifact_consumer_types (
          consumer_type, description, registered_by_migration
        ) values ('test:reference_insert', 'test', 'test');

        begin
          insert into public.published_source_version_references (
            consumer_type, consumer_id, evidence_table, evidence_id,
            source_version_id
          ) values (
            'test:reference_insert', consumer_id, 'test_evidence',
            gen_random_uuid(), version_id
          );
          raise exception 'pending artifact reference unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%requires a retained artifact%' then raise; end if;
        end;

        update public.ingestion_source_versions
        set artifact_retention_state = 'retained',
            private_object_key = 'test/' || version_id
        where id = version_id;
        insert into public.published_source_version_references (
          consumer_type, consumer_id, evidence_table, evidence_id,
          source_version_id
        ) values (
          'test:reference_insert', consumer_id, 'test_evidence',
          gen_random_uuid(), version_id
        );
      end;
      $$;
      select 'ok';
      rollback;
    `);
    expect(result).toContain("ROLLBACK");
  });
});
