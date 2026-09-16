export const councilMeetingParserFixtureSql = `
  insert into public.council_sessions (
    id, name, start_date, end_date, slug, kind
  ) values (
    '00000000-0000-0000-0000-000000000100',
    '令和8年9月定例会',
    '2026-09-01',
    '2026-09-30',
    'meeting-fixture-session',
    'regular'
  );
  insert into public.ingestion_sources (id, source, url)
  values (
    '00000000-0000-0000-0000-000000000101',
    'general_question_pdf',
    'https://example.com/meeting-fixture.pdf'
  );
  insert into public.ingestion_source_versions (
    id, ingestion_source_id, content_hash, fetched_at
  ) values (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000101',
    'sha256:meeting-fixture',
    now()
  );
  select public.transition_ingestion_source_version_retention(
    '00000000-0000-0000-0000-000000000102',
    'retained',
    '00000000-0000-0000-0000-000000000109',
    'meeting fixture setup',
    'meeting-fixtures/source.pdf'
  );
  insert into public.ingestion_runs (id, source)
  values (
    '00000000-0000-0000-0000-000000000103',
    'general_question_pdf'
  );
  insert into public.ingestion_parse_runs (
    id, ingestion_run_id, source_version_id, parser_name,
    parser_version, configuration_hash
  ) values (
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000102',
    'meeting-fixture-parser',
    '1.0.0',
    'sha256:meeting-fixture-config'
  );
  select public.finalize_ingestion_parse_run(
    '00000000-0000-0000-0000-000000000104',
    'completed',
    '{}'::jsonb,
    now()
  );
  insert into public.council_meetings (id, canonical_meeting_key)
  values (
    '00000000-0000-0000-0000-000000000105',
    'meeting-fixture-stable-key'
  );
  insert into public.council_meeting_revisions (
    id, meeting_id, revision_number, council_session_id, kind, held_on, display_title,
    status, source_support_status
  ) values (
    '00000000-0000-0000-0000-000000000106',
    '00000000-0000-0000-0000-000000000105',
    1,
    '00000000-0000-0000-0000-000000000100',
    'plenary',
    '2026-09-03',
    '令和8年9月定例会 本会議',
    'held',
    'official_supported'
  );
  insert into public.council_meeting_source_occurrences (
    id, meeting_id, ingestion_source_id, source_occurrence_key,
    source_system, external_id
  ) values (
    '00000000-0000-0000-0000-000000000107',
    '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000101',
    'meeting-1',
    'fixture',
    'fixture-meeting-1'
  );
  insert into public.council_meeting_source_evidence (
    id, revision_id, meeting_source_occurrence_id, source_version_id,
    parse_run_id, meeting_id, ingestion_source_id, role,
    source_evidence_key, locator, qa_status, extraction_method,
    verified_by, verified_at, observed_title, observed_held_on,
    observed_status
  ) values (
    '00000000-0000-0000-0000-000000000108',
    '00000000-0000-0000-0000-000000000106',
    '00000000-0000-0000-0000-000000000107',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000101',
    'record',
    'meeting-values',
    'page=1',
    'verified',
    'parser',
    '00000000-0000-0000-0000-000000000109',
    now(),
    '令和8年9月定例会 本会議',
    '2026-09-03',
    'held'
  );
`;

export const publishCouncilMeetingRevisionSql = `
  update public.council_meeting_revisions
  set qa_status = 'verified',
      reviewed_by = '00000000-0000-0000-0000-000000000109',
      reviewed_at = now()
  where id = '00000000-0000-0000-0000-000000000106';
  update public.council_meeting_revisions
  set publication_state = 'reviewed'
  where id = '00000000-0000-0000-0000-000000000106';
  update public.council_meeting_revisions
  set publication_state = 'published'
  where id = '00000000-0000-0000-0000-000000000106';
`;
