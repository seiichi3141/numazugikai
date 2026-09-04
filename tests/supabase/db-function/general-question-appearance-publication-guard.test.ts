import { describe, expect, it } from "vitest";
import {
  generalQuestionAppearanceFixtureSql,
  publishGeneralQuestionAppearanceSql,
} from "./general-question-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("general_question_appearance_publication_guard()", () => {
  it("適格な親会議とverified根拠がある登壇枠を公開できる", () => {
    const output = executeInTestDatabase(`
      begin;
      ${generalQuestionAppearanceFixtureSql}
      ${publishGeneralQuestionAppearanceSql}
      set constraints all immediate;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });
});
