import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("財政データ基盤", () => {
  it("一般会計と普通会計を別の集計範囲として保持する", () => {
    const result = executeInTestDatabase(`
      select string_agg(code, ',' order by code)
      from public.fiscal_reporting_scopes
      where code in ('general_account', 'ordinary_account');
    `);

    expect(result).toBe("general_account,ordinary_account");
  });

  it("nullを含む財政イベント自然キーの重複を拒否する", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare scope_id uuid;
      begin
        select id into scope_id from public.fiscal_reporting_scopes
          where code = 'all_accounts';
        insert into public.fiscal_events (
          fiscal_year, reporting_scope_id, event_kind
        ) values (2098, scope_id, 'initial_budget');

        begin
          insert into public.fiscal_events (
            fiscal_year, reporting_scope_id, event_kind
          ) values (2098, scope_id, 'initial_budget');
          raise exception 'duplicate fiscal event unexpectedly succeeded';
        exception
          when unique_violation then null;
        end;
      end;
      $$;
      select 'ok';
      rollback;
    `);

    expect(result).toContain("ROLLBACK");
  });

  it("会計別イベントを同年度・同集計範囲のmembershipへ固定する", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare
        account_id uuid;
        all_scope_id uuid;
        general_scope_id uuid;
        membership_id uuid;
      begin
        select id into account_id from public.fiscal_accounts
          where code = 'general';
        select id into all_scope_id from public.fiscal_reporting_scopes
          where code = 'all_accounts';
        select id into general_scope_id from public.fiscal_reporting_scopes
          where code = 'general_account';
        insert into public.fiscal_reporting_scope_memberships (
          reporting_scope_id, fiscal_year, account_id, member_key
        ) values (
          all_scope_id, 2093, account_id, 'account:' || account_id::text
        ) returning id into membership_id;

        begin
          insert into public.fiscal_events (
            fiscal_year, reporting_scope_id, account_id,
            scope_membership_id, event_kind
          ) values (
            2093, general_scope_id, account_id,
            membership_id, 'initial_budget'
          );
          raise exception 'mismatched membership unexpectedly succeeded';
        exception
          when foreign_key_violation then null;
        end;
      end;
      $$;
      select 'ok';
      rollback;
    `);

    expect(result).toContain("ROLLBACK");
  });

  it("提案・可決と実績のdecision stageを混在させない", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare scope_id uuid; event_id uuid;
      begin
        select id into scope_id from public.fiscal_reporting_scopes
          where code = 'all_accounts';
        insert into public.fiscal_events (
          fiscal_year, reporting_scope_id, event_kind
        ) values (2097, scope_id, 'initial_budget') returning id into event_id;

        begin
          insert into public.fiscal_amount_sets (
            fiscal_event_id, event_kind, decision_stage
          ) values (event_id, 'initial_budget', 'not_applicable');
          raise exception 'invalid decision stage unexpectedly succeeded';
        exception
          when check_violation then null;
        end;
      end;
      $$;
      select 'ok';
      rollback;
    `);

    expect(result).toContain("ROLLBACK");
  });

  it("スナップショットだけに基準日を要求する", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare scope_id uuid;
      begin
        select id into scope_id from public.fiscal_reporting_scopes
          where code = 'all_accounts';

        begin
          insert into public.fiscal_events (
            fiscal_year, reporting_scope_id, event_kind
          ) values (2095, scope_id, 'available_budget_snapshot');
          raise exception 'undated snapshot unexpectedly succeeded';
        exception
          when check_violation then null;
        end;

        begin
          insert into public.fiscal_events (
            fiscal_year, reporting_scope_id, event_kind, as_of_date
          ) values (2095, scope_id, 'initial_budget', '2095-04-01');
          raise exception 'dated initial budget unexpectedly succeeded';
        exception
          when check_violation then null;
        end;
      end;
      $$;
      select 'ok';
      rollback;
    `);

    expect(result).toContain("ROLLBACK");
  });

  it("0円と欠損を区別し、欠損理由のないnullを拒否する", () => {
    const result = executeInTestDatabase(`
      begin;
      do $$
      declare
        scope_id uuid;
        event_id uuid;
        amount_set_id uuid;
        amount_set_revision_id uuid;
        amount_id uuid;
      begin
        select id into scope_id from public.fiscal_reporting_scopes
          where code = 'all_accounts';
        insert into public.fiscal_events (
          fiscal_year, reporting_scope_id, event_kind
        ) values (2096, scope_id, 'initial_budget') returning id into event_id;
        insert into public.fiscal_amount_sets (
          fiscal_event_id, event_kind, decision_stage
        ) values (event_id, 'initial_budget', 'proposed')
          returning id into amount_set_id;
        insert into public.fiscal_amount_set_revisions (
          amount_set_id, fiscal_event_id, event_kind, revision_number,
          reporting_scope_id, fiscal_year
        ) values (
          amount_set_id, event_id, 'initial_budget', 1, scope_id, 2096
        ) returning id into amount_set_revision_id;
        insert into public.fiscal_amounts (
          amount_set_id, created_for_amount_set_revision_id, measure
        ) values (
          amount_set_id, amount_set_revision_id, 'expenditure_budget'
        ) returning id into amount_id;
        insert into public.fiscal_amount_revisions (
          amount_id, amount_set_id, amount_set_revision_id,
          revision_number, amount_yen
        ) values (
          amount_id, amount_set_id, amount_set_revision_id, 1, 0
        );

        begin
          insert into public.fiscal_amount_revisions (
            amount_id, amount_set_id, amount_set_revision_id,
            revision_number, amount_yen, null_reason
          ) values (
            amount_id, amount_set_id, amount_set_revision_id, 2, null, null
          );
          raise exception 'reasonless null unexpectedly succeeded';
        exception
          when check_violation then null;
        end;
      end;
      $$;
      select 'ok';
      rollback;
    `);

    expect(result).toContain("ROLLBACK");
  });

  it("membershipの資料内出現をstable membershipへ一意に割り当てる", () => {
    const result = executeInTestDatabase(`
      select indexdef
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'fiscal_reporting_scope_membership_source_occurrences'
        and indexdef like '%edition_source_occurrence_id%source_membership_key%';
    `);

    expect(result).toContain("edition_source_occurrence_id");
    expect(result).toContain("source_membership_key");
  });

  it("金額根拠のeditionとparse runを親出典へ固定する", () => {
    const occurrenceConstraints = executeInTestDatabase(`
      select string_agg(pg_get_constraintdef(oid), E'\\n')
      from pg_constraint
      where conrelid = 'public.fiscal_amount_set_sources'::regclass
        and contype = 'f';
    `);
    const evidenceConstraints = executeInTestDatabase(`
      select string_agg(pg_get_constraintdef(oid), E'\\n')
      from pg_constraint
      where conrelid = 'public.fiscal_amount_evidence'::regclass
        and contype = 'f';
    `);

    expect(occurrenceConstraints).toContain(
      "amount_set_source_occurrence_id, amount_set_id, edition_source_occurrence_id, edition_id"
    );
    expect(occurrenceConstraints).toContain("parse_run_identity_key");
    expect(evidenceConstraints).toContain("parse_run_identity_key");
  });
});
