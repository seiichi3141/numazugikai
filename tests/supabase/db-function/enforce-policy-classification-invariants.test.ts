import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";
import { publishedTaxonomyFixtureSql } from "./policy-classification-test-fixture";

describe("enforce_policy_classification_invariants()", () => {
  it("公開済みtaxonomyのtopic変更を拒否する", () => {
    expect(() =>
      executeInTestDatabase(`
        begin;
        ${publishedTaxonomyFixtureSql}
        insert into public.policy_topics (
          taxonomy_id, slug, label
        ) values (
          '00000000-0000-0000-0000-000000000401', 'new', '追加'
        );
        rollback;
      `)
    ).toThrow(/topics of a reviewed taxonomy are immutable/);
  });
});
