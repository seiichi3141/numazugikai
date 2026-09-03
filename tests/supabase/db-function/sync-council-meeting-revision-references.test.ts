import { describe, expect, it } from "vitest";
import {
  councilMeetingParserFixtureSql,
  publishCouncilMeetingRevisionSql,
} from "./council-meeting-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("sync_council_meeting_revision_references()", () => {
  it("公開時にparser根拠のactive referenceを登録する", () => {
    const output = executeInTestDatabase(`
      begin;
      ${councilMeetingParserFixtureSql}
      ${publishCouncilMeetingRevisionSql}
      do $test$
      begin
        if (
          select count(*) from public.published_source_version_references
          where consumer_type = 'common:council_meeting_revision'
            and consumer_id = '00000000-0000-0000-0000-000000000106'
            and released_at is null
        ) <> 1 then
          raise exception 'active reference was not synchronized';
        end if;
      end
      $test$;
      set constraints all immediate;
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });
});
