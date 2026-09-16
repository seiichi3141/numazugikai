import { describe, expect, it } from "vitest";
import {
  generalQuestionAppearanceFixtureSql,
  publishGeneralQuestionAppearanceSql,
} from "./general-question-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("sync_general_question_revision_references()", () => {
  it("登壇枠公開時にparser原本参照を登録する", () => {
    const output = executeInTestDatabase(`
      begin;
      ${generalQuestionAppearanceFixtureSql}
      ${publishGeneralQuestionAppearanceSql}
      do $test$
      begin
        if (
          select count(*) from public.published_source_version_references
          where consumer_type = 'general_question:appearance_revision'
            and consumer_id = '00000000-0000-0000-0000-000000000202'
            and released_at is null
        ) <> 1 then raise exception 'reference was not registered'; end if;
      end
      $test$;
      set constraints all immediate;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });
});
