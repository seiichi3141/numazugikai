export const fiscalParserEditionFixtureSql = `
  insert into public.ingestion_sources (id, source, url) values (
    '20000000-0000-0000-0000-000000000001',
    'fiscal_publication_test',
    'https://example.com/fiscal-publication-test.pdf'
  );
  insert into public.ingestion_source_versions (
    id, ingestion_source_id, content_hash, fetched_at
  ) values (
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'sha256:fiscal-publication-test', now()
  );
  select public.transition_ingestion_source_version_retention(
    '20000000-0000-0000-0000-000000000002',
    'retained',
    '20000000-0000-0000-0000-000000000099',
    'fiscal publication fixture',
    'fiscal-publication-test/source.pdf'
  );
  insert into public.ingestion_runs (id, source) values (
    '20000000-0000-0000-0000-000000000003',
    'fiscal_publication_test'
  );
  insert into public.ingestion_parse_runs (
    id, ingestion_run_id, source_version_id, parser_name,
    parser_version, configuration_hash
  ) values (
    '20000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000002',
    'fiscal-publication-test', '1.0.0',
    'sha256:fiscal-publication-test-config'
  );
  select public.finalize_ingestion_parse_run(
    '20000000-0000-0000-0000-000000000004',
    'completed', '{}'::jsonb, now()
  );
  insert into public.fiscal_source_documents (
    id, source_kind, series_code
  ) values (
    '20000000-0000-0000-0000-000000000005',
    'budget_overview', 'fiscal-publication-test'
  );
  insert into public.fiscal_source_document_editions (
    id, fiscal_source_document_id, edition_key
  ) values (
    '20000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000005', 'fy2090'
  );
  insert into public.fiscal_source_document_edition_source_occurrences (
    id, edition_id, fiscal_source_document_id, ingestion_source_id,
    source_edition_key
  ) values (
    '20000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000001', 'fy2090'
  );
  insert into public.fiscal_source_document_edition_observations (
    id, edition_id, fiscal_source_document_id,
    edition_source_occurrence_id, ingestion_source_id, source_version_id,
    parse_run_id, observation_revision, extraction_method, title,
    fiscal_year, publisher
  ) values (
    '20000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000004',
    1, 'parser', '令和72年度予算概要', 2090, '沼津市'
  );
`;

export const publishFiscalParserEditionSql = `
  update public.fiscal_source_document_edition_observations
  set qa_status = 'verified', publication_state = 'reviewed',
      verified_by = '20000000-0000-0000-0000-000000000099',
      verified_at = now()
  where id = '20000000-0000-0000-0000-000000000008';
  update public.fiscal_source_document_edition_observations
  set publication_state = 'published'
  where id = '20000000-0000-0000-0000-000000000008';
`;

export const fiscalClassificationFixtureSql = `
  insert into public.fiscal_classifications (
    id, scheme, canonical_key
  ) values (
    '20000000-0000-0000-0000-000000000010',
    'purpose', 'assembly'
  );
  insert into public.fiscal_classification_revisions (
    id, classification_id, scheme, revision_number, display_label,
    valid_from_fiscal_year
  ) values (
    '20000000-0000-0000-0000-000000000011',
    '20000000-0000-0000-0000-000000000010',
    'purpose', 1, '議会費', 2090
  );
  insert into public.fiscal_classification_source_occurrences (
    id, classification_id, scheme, edition_source_occurrence_id,
    edition_id, ingestion_source_id, source_classification_key
  ) values (
    '20000000-0000-0000-0000-000000000012',
    '20000000-0000-0000-0000-000000000010', 'purpose',
    '20000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000001', 'purpose:assembly'
  );
  insert into public.fiscal_classification_sources (
    id, classification_revision_id, classification_id, scheme,
    classification_source_occurrence_id, edition_source_occurrence_id,
    edition_observation_id, edition_id, ingestion_source_id,
    source_version_id, parse_run_id, source_label,
    observed_fiscal_year, extraction_method, qa_status,
    verified_by, verified_at
  ) values (
    '20000000-0000-0000-0000-000000000013',
    '20000000-0000-0000-0000-000000000011',
    '20000000-0000-0000-0000-000000000010', 'purpose',
    '20000000-0000-0000-0000-000000000012',
    '20000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000004',
    '議会費', 2090, 'parser', 'verified',
    '20000000-0000-0000-0000-000000000099', now()
  );
`;

export const publishFiscalClassificationSql = `
  update public.fiscal_classification_revisions
  set qa_status = 'verified', publication_state = 'reviewed',
      reviewed_by = '20000000-0000-0000-0000-000000000099',
      reviewed_at = now()
  where id = '20000000-0000-0000-0000-000000000011';
  update public.fiscal_classification_revisions
  set publication_state = 'published'
  where id = '20000000-0000-0000-0000-000000000011';
`;
