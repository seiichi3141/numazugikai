import { describe, expect, it } from "vitest";
import {
  councilMeetingParserFixtureSql,
  publishCouncilMeetingRevisionSql,
} from "./council-meeting-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("council_meeting_publication_guard()", () => {
  it("verified根拠が支える会議revisionだけを公開できる", () => {
    const output = executeInTestDatabase(`
      begin;
      ${councilMeetingParserFixtureSql}
      ${publishCouncilMeetingRevisionSql}
      set constraints all immediate;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });

  it("公開中の会議から最後のverified根拠を外せない", () => {
    const output = executeInTestDatabase(`
      begin;
      ${councilMeetingParserFixtureSql}
      ${publishCouncilMeetingRevisionSql}
      set constraints all immediate;
      set constraints all deferred;
      do $test$
      begin
        begin
          delete from public.council_meeting_source_evidence
          where id = '00000000-0000-0000-0000-000000000108';
          set constraints all immediate;
          raise exception 'evidence deletion unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%requires verified evidence%' then raise; end if;
        end;
      end
      $test$;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });
});
