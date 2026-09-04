import { describe, expect, it } from "vitest";
import { councilMeetingParserFixtureSql } from "./council-meeting-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("prevent_council_meeting_identity_mutation()", () => {
  it("会議正本とソース内出現の付け替えを拒否する", () => {
    const output = executeInTestDatabase(`
      begin;
      ${councilMeetingParserFixtureSql}
      do $test$
      begin
        begin
          update public.council_meetings
          set canonical_meeting_key = 'replacement-key'
          where id = '00000000-0000-0000-0000-000000000105';
          raise exception 'meeting identity update unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%meeting identity is immutable%' then raise; end if;
        end;
        begin
          update public.council_meeting_source_occurrences
          set source_occurrence_key = 'replacement-key'
          where id = '00000000-0000-0000-0000-000000000107';
          raise exception 'occurrence update unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%meeting identity is immutable%' then raise; end if;
        end;
      end
      $test$;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });
});
