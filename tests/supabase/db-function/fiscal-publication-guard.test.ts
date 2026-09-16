import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";
import {
  fiscalClassificationFixtureSql,
  fiscalParserEditionFixtureSql,
  publishFiscalClassificationSql,
  publishFiscalParserEditionSql,
} from "./fiscal-publication-test-fixture";

describe("fiscal_publication_guard()", () => {
  it("金額根拠の資料種別適格性と未レビューwarningを公開条件に含める", () => {
    const output = executeInTestDatabase(`
      select
        position(
          'and evidence_rule.may_be_primary'
          in pg_get_functiondef(
            'public.fiscal_publication_guard()'::regprocedure
          )
        ) > 0
        and position(
          'validation.severity in (''hard_error'', ''warning'')'
          in pg_get_functiondef(
            'public.fiscal_publication_guard()'::regprocedure
          )
        ) > 0;
    `);
    expect(output).toBe("t");
  });

  it("公開済み資料とverified根拠がある分類を公開できる", () => {
    const output = executeInTestDatabase(`
      begin;
      ${fiscalParserEditionFixtureSql}
      ${publishFiscalParserEditionSql}
      ${fiscalClassificationFixtureSql}
      ${publishFiscalClassificationSql}
      set constraints all immediate;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });

  it("根拠のない分類の公開をcommit前に拒否する", () => {
    expect(() =>
      executeInTestDatabase(`
        begin;
        insert into public.fiscal_classifications (
          id, scheme, canonical_key
        ) values (
          '20000000-0000-0000-0000-000000000020',
          'purpose', 'missing-evidence'
        );
        insert into public.fiscal_classification_revisions (
          id, classification_id, scheme, revision_number, display_label,
          valid_from_fiscal_year
        ) values (
          '20000000-0000-0000-0000-000000000021',
          '20000000-0000-0000-0000-000000000020',
          'purpose', 1, '根拠なし', 2090
        );
        update public.fiscal_classification_revisions
        set qa_status = 'verified', publication_state = 'reviewed',
            reviewed_by = gen_random_uuid(), reviewed_at = now()
        where id = '20000000-0000-0000-0000-000000000021';
        update public.fiscal_classification_revisions
        set publication_state = 'published'
        where id = '20000000-0000-0000-0000-000000000021';
        set constraints all immediate;
      `)
    ).toThrow(/invalid evidence or parent/);
  });
});
