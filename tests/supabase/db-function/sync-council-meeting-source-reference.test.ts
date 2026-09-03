import { describe, expect, it } from "vitest";
import {
  councilMeetingParserFixtureSql,
  publishCouncilMeetingRevisionSql,
} from "./council-meeting-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("sync_council_meeting_source_reference()", () => {
  it("公開中のparser根拠をrejectedにするとactive referenceをreleaseする", () => {
    const output = executeInTestDatabase(`
      begin;
      ${councilMeetingParserFixtureSql}
      ${publishCouncilMeetingRevisionSql}
      set constraints all immediate;
      set constraints all deferred;
      do $test$
      begin
        begin
          update public.council_meeting_source_evidence
          set qa_status = 'rejected', verified_by = null, verified_at = null
          where id = '00000000-0000-0000-0000-000000000108';
          if exists (
            select 1 from public.published_source_version_references
            where evidence_id = '00000000-0000-0000-0000-000000000108'
              and released_at is null
          ) then
            raise exception 'active reference was not released';
          end if;
          set constraints all immediate;
          raise exception 'evidence rejection unexpectedly committed';
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
