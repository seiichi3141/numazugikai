import { describe, expect, it } from "vitest";
import { councilMeetingParserFixtureSql } from "./council-meeting-test-fixture";
import { executeInTestDatabase } from "./ingestion-audit-test-database";

describe("general_question_coverage_publication_guard()", () => {
  it("verified根拠のないcoverage公開を拒否する", () => {
    expect(() =>
      executeInTestDatabase(`begin; ${councilMeetingParserFixtureSql}
        insert into public.general_question_session_coverage (
          id, council_session_id, source_kind
        ) values (
          '00000000-0000-0000-0000-000000000521',
          '00000000-0000-0000-0000-000000000100', 'general_question_pdf'
        );
        insert into public.general_question_session_coverage_observations (
          id, coverage_id, council_session_id, source_kind, observation_key,
          state, record_presence, session_disposition, expected_count,
          matched_count, checked_at, qa_status, publication_state,
          reviewed_by, reviewed_at
        ) values (
          '00000000-0000-0000-0000-000000000522',
          '00000000-0000-0000-0000-000000000521',
          '00000000-0000-0000-0000-000000000100', 'general_question_pdf',
          'check-1', 'collected', 'present', 'held', 1, 1, now(),
          'verified', 'published',
          '00000000-0000-0000-0000-000000000109', now()
        );
        set constraints all immediate; rollback;`)
    ).toThrow(/published coverage requires verified primary evidence/);
  });
});
