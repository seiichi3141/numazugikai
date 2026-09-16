import { describe, expect, it } from "vitest";
import { generalQuestionAppearanceFixtureSql } from "./general-question-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_general_question_revision_update()", () => {
  it("revisionの正規化内容を直接変更できない", () => {
    expect(() =>
      executeInTestDatabase(`begin; ${generalQuestionAppearanceFixtureSql}
        update public.general_question_appearance_revisions
        set speaker_display_name = '変更'
        where id = '00000000-0000-0000-0000-000000000202'; rollback;`)
    ).toThrow(/revision content is immutable/);
  });
});
