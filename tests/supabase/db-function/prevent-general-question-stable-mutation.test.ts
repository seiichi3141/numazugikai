import { describe, expect, it } from "vitest";
import { generalQuestionAppearanceFixtureSql } from "./general-question-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("prevent_general_question_stable_mutation()", () => {
  it("登壇枠の安定キー変更を拒否する", () => {
    expect(() =>
      executeInTestDatabase(`begin; ${generalQuestionAppearanceFixtureSql}
        update public.general_question_appearances
        set appearance_key = 'changed'
        where id = '00000000-0000-0000-0000-000000000201'; rollback;`)
    ).toThrow(/general question stable identity is immutable/);
  });
});
