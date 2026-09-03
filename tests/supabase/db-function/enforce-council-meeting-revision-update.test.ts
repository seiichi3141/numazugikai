import { describe, expect, it } from "vitest";
import { councilMeetingParserFixtureSql } from "./council-meeting-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("enforce_council_meeting_revision_update()", () => {
  it("正規化内容の上書きを拒否し、QA状態の更新は許可する", () => {
    const output = executeInTestDatabase(`
      begin;
      ${councilMeetingParserFixtureSql}
      do $test$
      begin
        begin
          update public.council_meeting_revisions
          set display_title = '上書き'
          where id = '00000000-0000-0000-0000-000000000106';
          raise exception 'content update unexpectedly succeeded';
        exception
          when others then
            if sqlerrm not like '%revision content is immutable%' then raise; end if;
        end;
      end
      $test$;
      update public.council_meeting_revisions
      set qa_status = 'verified',
          reviewed_by = '00000000-0000-0000-0000-000000000109',
          reviewed_at = now()
      where id = '00000000-0000-0000-0000-000000000106';
      rollback;
    `);
    expect(output).toContain("ROLLBACK");
  });
});
