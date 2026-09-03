import { describe, expect, it } from "vitest";
import { councilMeetingParserFixtureSql } from "./council-meeting-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_general_question_import_batch_update()", () => {
  it("batchの取得版を変更できない", () => {
    expect(() =>
      executeInTestDatabase(`begin; ${councilMeetingParserFixtureSql}
        insert into public.general_question_import_batches (
          id, parse_run_id, source_version_id
        ) values (
          '00000000-0000-0000-0000-000000000501',
          '00000000-0000-0000-0000-000000000104',
          '00000000-0000-0000-0000-000000000102'
        );
        update public.general_question_import_batches
        set parse_run_id = gen_random_uuid()
        where id = '00000000-0000-0000-0000-000000000501'; rollback;`)
    ).toThrow(/import batch identity is immutable/);
  });
});
