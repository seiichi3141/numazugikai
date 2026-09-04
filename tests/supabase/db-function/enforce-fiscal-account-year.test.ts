import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_fiscal_account_year()", () => {
  it("membershipとeventで会計の有効期間外年度を拒否する", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare
        account_id uuid;
        scope_id uuid;
        membership_id uuid;
        target_table text;
      begin
        insert into public.fiscal_accounts (
          code, name, account_type, valid_from_fiscal_year,
          valid_to_fiscal_year
        ) values (
          'closed-test-account', '終了済みテスト会計', 'special', 2024, 2024
        ) returning id into account_id;
        select id into scope_id from public.fiscal_reporting_scopes
          where code = 'all_accounts';

        foreach target_table in array array[
          'fiscal_reporting_scope_memberships', 'fiscal_events'
        ] loop
          begin
            if target_table = 'fiscal_reporting_scope_memberships' then
              insert into public.fiscal_reporting_scope_memberships (
                reporting_scope_id, fiscal_year, account_id, member_key
              ) values (
                scope_id, 2025, account_id, 'account:' || account_id::text
              );
            else
              insert into public.fiscal_reporting_scope_memberships (
                reporting_scope_id, fiscal_year, account_id, member_key
              ) values (
                scope_id, 2024, account_id, 'account:' || account_id::text
              ) returning id into membership_id;
              insert into public.fiscal_events (
                fiscal_year, reporting_scope_id, account_id,
                scope_membership_id, event_kind
              ) values (
                2025, scope_id, account_id,
                membership_id, 'initial_budget'
              );
            end if;
            raise exception 'out-of-period insert unexpectedly succeeded';
          exception
            when others then
              if sqlerrm not like '%not valid for fiscal year%' then raise; end if;
          end;
        end loop;
      end;
      $$;
      select 'ok';
      rollback;
    `);

    expect(result).toContain("ROLLBACK");
  });

  it("有効年度とaccountなしの集計範囲を許可する", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare account_id uuid; scope_id uuid; membership_id uuid;
      begin
        select id into account_id from public.fiscal_accounts
          where code = 'general';
        select id into scope_id from public.fiscal_reporting_scopes
          where code = 'all_accounts';
        insert into public.fiscal_reporting_scope_memberships (
          reporting_scope_id, fiscal_year, account_id, member_key
        ) values (
          scope_id, 2026, account_id, 'account:' || account_id::text
        ) returning id into membership_id;
        insert into public.fiscal_events (
          fiscal_year, reporting_scope_id, account_id,
          scope_membership_id, event_kind
        ) values (
          2026, scope_id, account_id, membership_id, 'initial_budget'
        );
        insert into public.fiscal_events (
          fiscal_year, reporting_scope_id, event_kind
        ) values (2094, scope_id, 'initial_budget');
      end;
      $$;
      select 'ok';
      rollback;
    `);

    expect(result).toContain("ROLLBACK");
  });
});
