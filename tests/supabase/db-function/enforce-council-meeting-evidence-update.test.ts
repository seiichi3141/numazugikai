import { describe, expect, it } from "vitest";
import { councilMeetingParserFixtureSql } from "./council-meeting-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_council_meeting_evidence_update()", () => {
  it("観測値の上書きを拒否する", () => {
    const output = executeInTestDatabase(`
      begin;
      ${councilMeetingParserFixtureSql}
      do $test$
      begin
        begin
          update public.council_meeting_source_evidence
          set observed_title = '上書き'
          where id = '00000000-0000-0000-0000-000000000108';
          raise exception 'evidence update unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%evidence content is immutable%' then raise; end if;
        end;
      end
      $test$;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });
});
