import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("prevent_fiscal_audit_snapshot_mutation()", () => {
  it("17の監査テーブルでtruncateを引き続き拒否する", () => {
    const result = executeInTestDatabase(`
      select count(*)
      from pg_trigger
      where tgfoid =
        'public.prevent_fiscal_audit_snapshot_mutation()'::regprocedure
        and not tgisinternal;
    `);

    expect(result).toBe("17");
  });

  it("revisionのUPDATEとDELETEを拒否する", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare classification_id uuid; revision_id uuid;
      begin
        insert into public.fiscal_classifications (scheme, canonical_key)
        values ('purpose', 'snapshot-test') returning id into classification_id;
        insert into public.fiscal_classification_revisions (
          classification_id, scheme, revision_number, display_label,
          valid_from_fiscal_year
        ) values (
          classification_id, 'purpose', 1, '監査テスト', 2024
        ) returning id into revision_id;

        begin
          update public.fiscal_classification_revisions
          set display_label = '変更不可' where id = revision_id;
          raise exception 'audit snapshot update unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%publication content is immutable%' then raise; end if;
        end;

        begin
          delete from public.fiscal_classification_revisions
          where id = revision_id;
          raise exception 'audit snapshot delete unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%publication history is append-only%' then raise; end if;
        end;
      end;
      $$;
      select 'ok';
      rollback;
    `);

    expect(result).toContain("ROLLBACK");
  });
});
