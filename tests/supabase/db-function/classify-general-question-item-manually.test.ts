import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";
import { publishedGeneralQuestionItemFixtureSql } from "./policy-classification-test-fixture";

describe("classify_general_question_item_manually()", () => {
  it("公開質問項目を複数の政策分野へ人手分類する", () => {
    const output = executeInTestDatabase(`begin;
      ${publishedGeneralQuestionItemFixtureSql}
      select public.classify_general_question_item_manually(
        '00000000-0000-0000-0000-000000000302',
        array[
          '10000000-0000-0000-0000-000000000101'::uuid,
          '10000000-0000-0000-0000-000000000106'::uuid
        ],
        '00000000-0000-0000-0000-000000000109'
      );
      set constraints all immediate;
      rollback;`);
    expect(output).toContain("ROLLBACK");
  });
});
