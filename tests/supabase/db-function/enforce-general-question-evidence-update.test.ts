import { describe, expect, it } from "vitest";
import { generalQuestionAppearanceFixtureSql } from "./general-question-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_general_question_evidence_update()", () => {
  it("版別根拠の抽出値を直接変更できない", () => {
    expect(() =>
      executeInTestDatabase(`begin; ${generalQuestionAppearanceFixtureSql}
        update public.general_question_appearance_sources
        set observed_speaker_name = '変更'
        where id = '00000000-0000-0000-0000-000000000204'; rollback;`)
    ).toThrow(/general question evidence content is immutable/);
  });
});
