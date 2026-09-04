import { describe, expect, it } from "vitest";
import {
  generalQuestionAppearanceFixtureSql,
  publishGeneralQuestionAppearanceSql,
} from "./general-question-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("sync_general_question_evidence_reference()", () => {
  it("根拠をrejectedにするとactive referenceをreleaseする", () => {
    const output = executeInTestDatabase(`
      begin;
      ${generalQuestionAppearanceFixtureSql}
      ${publishGeneralQuestionAppearanceSql}
      set constraints all immediate;
      set constraints all deferred;
      do $test$
      begin
        begin
          update public.general_question_appearance_sources
          set qa_status = 'rejected', verified_by = null, verified_at = null
          where id = '00000000-0000-0000-0000-000000000204';
          if exists (
            select 1 from public.published_source_version_references
            where evidence_id = '00000000-0000-0000-0000-000000000204'
              and released_at is null
          ) then raise exception 'reference remained active'; end if;
          set constraints all immediate;
          raise exception 'rejection unexpectedly committed';
        exception when others then
          if sqlerrm not like '%requires verified evidence%' then raise; end if;
        end;
      end
      $test$;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });
});
