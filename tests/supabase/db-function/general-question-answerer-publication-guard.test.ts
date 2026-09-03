import { describe, expect, it } from "vitest";
import { publishedGeneralQuestionAnswererFixtureSql } from "./general-question-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("general_question_answerer_publication_guard()", () => {
  it("適格な親登壇枠とverified根拠がある答弁者を公開できる", () => {
    const output = executeInTestDatabase(
      `begin; ${publishedGeneralQuestionAnswererFixtureSql}
       set constraints all immediate; rollback;`
    );
    expect(output).toContain("ROLLBACK");
  });
});
