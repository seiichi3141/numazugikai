import {
  councilMeetingParserFixtureSql,
  publishCouncilMeetingRevisionSql,
} from "./council-meeting-test-fixture";

export const generalQuestionAppearanceFixtureSql = `
  ${councilMeetingParserFixtureSql}
  ${publishCouncilMeetingRevisionSql}
  insert into public.general_question_appearances (
    id, meeting_id, appearance_key
  ) values (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000105',
    'speaker-1'
  );
  insert into public.general_question_appearance_revisions (
    id, appearance_id, meeting_id, revision_number, speaker_display_name,
    seat_number, question_order, question_kind, delivery_method
  ) values (
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000105',
    1, 'テスト議員', 1, 1, 'personal', 'one_by_one'
  );
  insert into public.general_question_appearance_source_occurrences (
    id, appearance_id, meeting_id, meeting_source_occurrence_id,
    ingestion_source_id, source_appearance_key
  ) values (
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000107',
    '00000000-0000-0000-0000-000000000101',
    'appearance-1'
  );
  insert into public.general_question_appearance_sources (
    id, appearance_source_occurrence_id, appearance_revision_id,
    appearance_id, meeting_id, ingestion_source_id, source_version_id,
    parse_run_id, source_locator, role, extraction_method,
    observed_speaker_name, observed_seat_number, observed_question_order,
    observed_question_kind, observed_delivery_method, qa_status,
    verified_by, verified_at
  ) values (
    '00000000-0000-0000-0000-000000000204',
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000104',
    'page=1', 'primary', 'parser', 'テスト議員', 1, 1,
    'personal', 'one_by_one', 'verified',
    '00000000-0000-0000-0000-000000000109', now()
  );
`;

export const publishGeneralQuestionAppearanceSql = `
  update public.general_question_appearance_revisions
  set qa_status = 'verified',
      reviewed_by = '00000000-0000-0000-0000-000000000109',
      reviewed_at = now()
  where id = '00000000-0000-0000-0000-000000000202';
  update public.general_question_appearance_revisions
  set publication_state = 'reviewed'
  where id = '00000000-0000-0000-0000-000000000202';
  update public.general_question_appearance_revisions
  set publication_state = 'published', published_at = now()
  where id = '00000000-0000-0000-0000-000000000202';
`;

export const publishedGeneralQuestionAnswererFixtureSql = `
  ${generalQuestionAppearanceFixtureSql}
  ${publishGeneralQuestionAppearanceSql}
  insert into public.general_question_answerers (
    id, appearance_id, answerer_key
  ) values (
    '00000000-0000-0000-0000-000000000211',
    '00000000-0000-0000-0000-000000000201',
    'answerer-1'
  );
  insert into public.general_question_answerer_revisions (
    id, answerer_id, appearance_id, revision_number, person_display_name,
    role_display_name, role_group, display_order
  ) values (
    '00000000-0000-0000-0000-000000000212',
    '00000000-0000-0000-0000-000000000211',
    '00000000-0000-0000-0000-000000000201',
    1, '沼津市長', '市長', 'mayor', 1
  );
  insert into public.general_question_answerer_source_occurrences (
    id, answerer_id, appearance_id, appearance_source_occurrence_id,
    source_answerer_key
  ) values (
    '00000000-0000-0000-0000-000000000213',
    '00000000-0000-0000-0000-000000000211',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000203',
    'answerer-1'
  );
  insert into public.general_question_answerer_sources (
    id, answerer_source_occurrence_id, appearance_source_occurrence_id,
    answerer_revision_id, answerer_id, appearance_id, appearance_source_id,
    source_locator, observed_person_name, observed_role_name, qa_status,
    verified_by, verified_at
  ) values (
    '00000000-0000-0000-0000-000000000214',
    '00000000-0000-0000-0000-000000000213',
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000212',
    '00000000-0000-0000-0000-000000000211',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000204',
    'page=1;answerer=1', '沼津市長', '市長', 'verified',
    '00000000-0000-0000-0000-000000000109', now()
  );
  update public.general_question_answerer_revisions
  set qa_status = 'verified',
      reviewed_by = '00000000-0000-0000-0000-000000000109',
      reviewed_at = now()
  where id = '00000000-0000-0000-0000-000000000212';
  update public.general_question_answerer_revisions
  set publication_state = 'reviewed'
  where id = '00000000-0000-0000-0000-000000000212';
  update public.general_question_answerer_revisions
  set publication_state = 'published'
  where id = '00000000-0000-0000-0000-000000000212';
`;
