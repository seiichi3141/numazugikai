-- 公開parser根拠と共通active-reference registryの集合を常に完全一致させる。
create function enforce_general_question_registry_completeness()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    with expected as (
      select 'general_question:appearance_revision'::text consumer_type,
        revision.id consumer_id, 'general_question_appearance_sources'::text evidence_table,
        evidence.id evidence_id, evidence.source_version_id
      from public.general_question_appearance_revisions revision
      join public.general_question_appearance_sources evidence
        on evidence.appearance_revision_id = revision.id
      where revision.publication_state = 'published'
        and revision.qa_status = 'verified'
        and evidence.extraction_method = 'parser' and evidence.qa_status = 'verified'
      union all
      select 'general_question:item_revision', revision.id,
        'general_question_item_sources', evidence.id,
        appearance_evidence.source_version_id
      from public.general_question_item_revisions revision
      join public.general_question_item_sources evidence
        on evidence.question_item_revision_id = revision.id
      join public.general_question_appearance_sources appearance_evidence
        on appearance_evidence.id = evidence.appearance_source_id
      where revision.publication_state = 'published'
        and revision.qa_status = 'verified' and evidence.qa_status = 'verified'
        and appearance_evidence.extraction_method = 'parser'
      union all
      select 'general_question:answerer_revision', revision.id,
        'general_question_answerer_sources', evidence.id,
        appearance_evidence.source_version_id
      from public.general_question_answerer_revisions revision
      join public.general_question_answerer_sources evidence
        on evidence.answerer_revision_id = revision.id
      join public.general_question_appearance_sources appearance_evidence
        on appearance_evidence.id = evidence.appearance_source_id
      where revision.publication_state = 'published'
        and revision.qa_status = 'verified' and evidence.qa_status = 'verified'
        and appearance_evidence.extraction_method = 'parser'
      union all
      select 'general_question:session_coverage_observation', revision.id,
        'general_question_session_coverage_observation_sources', evidence.id,
        evidence.source_version_id
      from public.general_question_session_coverage_observations revision
      join public.general_question_session_coverage_observation_sources evidence
        on evidence.observation_id = revision.id
      where revision.publication_state = 'published'
        and revision.qa_status = 'verified'
        and evidence.extraction_method = 'parser' and evidence.qa_status = 'verified'
    ), actual as (
      select consumer_type, consumer_id, evidence_table, evidence_id,
        source_version_id
      from public.published_source_version_references
      where consumer_type like 'general_question:%' and released_at is null
    )
    select 1 from (
      (select * from expected except select * from actual)
      union all
      (select * from actual except select * from expected)
    ) mismatch
  ) then
    raise exception 'general question parser evidence and source registry must match';
  end if;
  return null;
end;
$$;

do $triggers$
declare
  table_name text;
begin
  foreach table_name in array array[
    'general_question_appearance_revisions',
    'general_question_appearance_sources',
    'general_question_item_revisions',
    'general_question_item_sources',
    'general_question_answerer_revisions',
    'general_question_answerer_sources',
    'general_question_session_coverage_observations',
    'general_question_session_coverage_observation_sources',
    'published_source_version_references'
  ] loop
    execute format(
      'create constraint trigger %I after insert or update or delete on %I deferrable initially deferred for each row execute function enforce_general_question_registry_completeness()',
      table_name || '_general_question_registry_complete', table_name
    );
  end loop;
end
$triggers$;

revoke all on function enforce_general_question_registry_completeness()
from public, anon, authenticated, service_role;
