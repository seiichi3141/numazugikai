import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("block_fiscal_publication_before_guards()", () => {
  it("公開状態を持つ5テーブルにfail-closed triggerを設定する", () => {
    const result = executeInTestDatabase(`
      select count(*)
      from pg_trigger
      where tgname in (
        'fiscal_document_publication_fail_closed',
        'fiscal_membership_publication_fail_closed',
        'fiscal_classification_publication_fail_closed',
        'fiscal_amount_set_publication_fail_closed',
        'fiscal_bill_link_publication_fail_closed'
      ) and not tgisinternal;
    `);

    expect(result).toBe("5");
  });

  it("draftは許可し、publishedのINSERTを拒否する", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare classification_id uuid;
      begin
        insert into public.fiscal_classifications (scheme, canonical_key)
        values ('purpose', 'publication-test')
        returning id into classification_id;
        insert into public.fiscal_classification_revisions (
          classification_id, scheme, revision_number, display_label,
          valid_from_fiscal_year
        ) values (
          classification_id, 'purpose', 1, '下書き', 2024
        );

        begin
          insert into public.fiscal_classification_revisions (
            classification_id, scheme, revision_number, display_label,
            valid_from_fiscal_year, qa_status, publication_state,
            reviewed_by, reviewed_at
          ) values (
            classification_id, 'purpose', 2, '公開テスト', 2024,
            'verified', 'published', gen_random_uuid(), now()
          );
          raise exception 'unguarded publication insert unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%publication is disabled%' then raise; end if;
        end;
      end;
      $$;
      select 'ok';
      rollback;
    `);

    expect(result).toContain("ROLLBACK");
  });
});
