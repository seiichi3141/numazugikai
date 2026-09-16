import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";
import {
  fiscalParserEditionFixtureSql,
  publishFiscalParserEditionSql,
} from "./fiscal-publication-test-fixture";

describe("refresh_fiscal_source_registry()", () => {
  it("parser根拠の公開とsuperseded化をactive参照へ同期する", () => {
    const output = executeInTestDatabase(`
      begin;
      ${fiscalParserEditionFixtureSql}
      ${publishFiscalParserEditionSql}
      do $$
      begin
        if (select count(*)
          from public.published_source_version_references
          where consumer_type = 'fiscal_data' and released_at is null) <> 1 then
          raise exception 'active fiscal reference was not created';
        end if;
      end;
      $$;
      update public.fiscal_source_document_edition_observations
      set publication_state = 'superseded'
      where id = '20000000-0000-0000-0000-000000000008';
      do $$
      begin
        if exists (
          select 1 from public.published_source_version_references
          where consumer_type = 'fiscal_data' and released_at is null
        ) then
          raise exception 'active fiscal reference was not released';
        end if;
      end;
      $$;
      set constraints all immediate;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });
});
