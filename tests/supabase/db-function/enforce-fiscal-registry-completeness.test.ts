import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";
import {
  fiscalParserEditionFixtureSql,
  publishFiscalParserEditionSql,
} from "./fiscal-publication-test-fixture";

describe("enforce_fiscal_registry_completeness()", () => {
  it("activeな財政参照の直接releaseをcommit前に拒否する", () => {
    expect(() =>
      executeInTestDatabase(`
        begin;
        ${fiscalParserEditionFixtureSql}
        ${publishFiscalParserEditionSql}
        update public.published_source_version_references
        set released_at = now()
        where consumer_type = 'fiscal_data' and released_at is null;
        set constraints all immediate;
      `)
    ).toThrow(/source registry must match/);
  });
});
