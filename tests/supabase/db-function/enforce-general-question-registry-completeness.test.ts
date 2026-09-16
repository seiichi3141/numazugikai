import { describe, expect, it } from "vitest";
import {
  generalQuestionAppearanceFixtureSql,
  publishGeneralQuestionAppearanceSql,
} from "./general-question-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_general_question_registry_completeness()", () => {
  it("公開parser根拠に対応するactive referenceの欠落を拒否する", () => {
    expect(() =>
      executeInTestDatabase(`begin; ${generalQuestionAppearanceFixtureSql}
        ${publishGeneralQuestionAppearanceSql}
        update public.published_source_version_references
        set released_at = now()
        where consumer_type = 'general_question:appearance_revision'
          and released_at is null;
        set constraints all immediate; rollback;`)
    ).toThrow(
      /general question parser evidence and source registry must match/
    );
  });
});
