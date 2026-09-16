import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("fiscal_cross_source_validation_guard()", () => {
  it("検算・比較根拠・金額根拠の変更をすべて遅延検査する", () => {
    const output = executeInTestDatabase(`
      select count(*)
      from pg_trigger trigger
      where trigger.tgname in (
        'fiscal_validation_cross_source_complete',
        'fiscal_validation_evidence_cross_source_complete',
        'fiscal_amount_evidence_cross_source_complete'
      ) and trigger.tgdeferrable and not trigger.tgisinternal;
    `);
    expect(output).toBe("3");
  });

  it("独立した2出典と必須ロールがないcross_source合格を拒否する", () => {
    expect(() =>
      executeInTestDatabase(`
        begin;
        do $$
        declare scope_id uuid; event_id uuid; amount_set_id uuid;
          revision_id uuid; validation_id uuid;
        begin
          select id into scope_id from public.fiscal_reporting_scopes
          where code = 'general_account';
          insert into public.fiscal_events (
            fiscal_year, reporting_scope_id, event_kind
          ) values (2090, scope_id, 'initial_budget') returning id into event_id;
          insert into public.fiscal_amount_sets (
            fiscal_event_id, event_kind, decision_stage
          ) values (event_id, 'initial_budget', 'proposed')
          returning id into amount_set_id;
          insert into public.fiscal_amount_set_revisions (
            amount_set_id, fiscal_event_id, event_kind, revision_number,
            reporting_scope_id, fiscal_year
          ) values (
            amount_set_id, event_id, 'initial_budget', 1, scope_id, 2090
          ) returning id into revision_id;
          insert into public.fiscal_validation_results (
            validation_scope, amount_set_id, amount_set_revision_id,
            rule_code, severity
          ) values (
            'cross_source', amount_set_id, revision_id,
            'two-independent-sources', 'hard_error'
          ) returning id into validation_id;
          update public.fiscal_validation_results
          set status = 'passed' where id = validation_id;
        end;
        $$;
        set constraints all immediate;
      `)
    ).toThrow(/requires two verified independent sources/);
  });
});
