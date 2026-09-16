import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("prevent_fiscal_stable_identity_mutation()", () => {
  it("21の安定IDテーブルに更新削除・truncate triggerを設定する", () => {
    const result = executeInTestDatabase(`
      select count(*)
      from pg_trigger
      where tgfoid =
        'public.prevent_fiscal_stable_identity_mutation()'::regprocedure
        and not tgisinternal;
    `);

    expect(result).toBe("42");
  });

  it("安定IDのUPDATEとDELETEを拒否する", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      begin
        begin
          update public.fiscal_accounts
          set name = '変更不可'
          where code = 'general';
          raise exception 'stable identity update unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%append-only%' then raise; end if;
        end;

        begin
          delete from public.fiscal_reporting_scopes
          where code = 'ordinary_account';
          raise exception 'stable identity delete unexpectedly succeeded';
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
