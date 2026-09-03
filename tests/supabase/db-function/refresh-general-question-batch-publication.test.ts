import { describe, expect, it } from "vitest";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("refresh_general_question_batch_publication()", () => {
  it("存在しないstaging IDは公開状態を変更しない", () => {
    const output = executeInTestDatabase(`begin;
      select public.refresh_general_question_batch_publication(
        gen_random_uuid(), '00000000-0000-0000-0000-000000000109'
      );
      rollback;`);
    expect(output).toContain("ROLLBACK");
  });
});
