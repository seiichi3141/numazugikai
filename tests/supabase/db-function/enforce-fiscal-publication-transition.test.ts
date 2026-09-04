import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_fiscal_publication_transition()", () => {
  it("7種の公開行で内容を凍結し順方向の状態遷移だけを許可する", () => {
    const output = executeInTestDatabase(`
      select count(*)
      from pg_trigger trigger
      join pg_proc procedure on procedure.oid = trigger.tgfoid
      where procedure.proname = 'enforce_fiscal_publication_transition'
        and not trigger.tgisinternal;
    `);
    expect(output).toBe("7");
  });

  it("draftへの巻き戻しと正規値の更新を拒否する", () => {
    const output = executeInTestDatabase(`
      begin;
      do $$
      declare classification_id uuid; revision_id uuid;
      begin
        insert into public.fiscal_classifications (scheme, canonical_key)
        values ('purpose', 'transition-test') returning id into classification_id;
        insert into public.fiscal_classification_revisions (
          classification_id, scheme, revision_number, display_label,
          valid_from_fiscal_year
        ) values (classification_id, 'purpose', 1, '遷移テスト', 2090)
        returning id into revision_id;
        update public.fiscal_classification_revisions
        set qa_status = 'verified', publication_state = 'reviewed',
            reviewed_by = gen_random_uuid(), reviewed_at = now()
        where id = revision_id;
        begin
          update public.fiscal_classification_revisions
          set publication_state = 'draft' where id = revision_id;
          raise exception 'rollback unexpectedly succeeded';
        exception when others then
          if sqlerrm not like '%invalid fiscal publication transition%' then
            raise;
          end if;
        end;
        begin
          update public.fiscal_classification_revisions
          set display_label = '改ざん' where id = revision_id;
          raise exception 'content update unexpectedly succeeded';
        exception when others then
          if sqlerrm not like '%publication content is immutable%' then raise; end if;
        end;
      end;
      $$;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });
});
