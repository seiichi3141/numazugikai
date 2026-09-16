import { describe, expect, it } from "vitest";
import {
  generalQuestionAppearanceFixtureSql,
  publishGeneralQuestionAppearanceSql,
} from "./general-question-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("general_question_parent_publication_guard()", () => {
  it("公開登壇枠を残したまま親会議を非公開にできない", () => {
    expect(() =>
      executeInTestDatabase(`begin; ${generalQuestionAppearanceFixtureSql}
        ${publishGeneralQuestionAppearanceSql}
        update public.council_meeting_revisions
        set publication_state = 'superseded'
        where id = '00000000-0000-0000-0000-000000000106';
        set constraints all immediate; rollback;`)
    ).toThrow(/published appearance requires an eligible published meeting/);
  });
});
