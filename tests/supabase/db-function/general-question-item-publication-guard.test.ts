import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";
import { publishedGeneralQuestionItemFixtureSql } from "./policy-classification-test-fixture";

describe("general_question_item_publication_guard()", () => {
  it("適格な親登壇枠とverified根拠がある項目を公開できる", () => {
    const output = executeInTestDatabase(
      `begin; ${publishedGeneralQuestionItemFixtureSql}
       set constraints all immediate; rollback;`
    );
    expect(output).toContain("ROLLBACK");
  });
});
