-- 全staging行のQA完了後、会期全体の資料カバレッジを再集計して公開する。
create function refresh_general_question_batch_publication(
  p_staging_id uuid,
  p_reviewed_by uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.general_question_import_batches%rowtype;
  v_coverage_id uuid;
  v_observation_id uuid;
  v_occurrence_id uuid;
  v_expected_count integer;
  v_matched_count integer;
  v_source record;
  v_source_name text;
  v_coverage_kind text;
  v_evidence_method public.extraction_method_enum;
begin
  select batch.* into v_batch
  from public.general_question_import_batches batch
  join public.general_question_staging_appearances staged
    on staged.batch_id = batch.id
  where staged.id = p_staging_id
  for update of batch;
  if not found or v_batch.council_session_id is null then return; end if;
  select source.source into v_source_name
  from public.ingestion_source_versions version
  join public.ingestion_sources source
    on source.id = version.ingestion_source_id
  where version.id = v_batch.source_version_id;
  v_coverage_kind := case v_source_name
    when 'general_question_pdf' then 'general_question_pdf'
    when 'general_question_record' then 'meeting_record'
    else null
  end;
  if v_coverage_kind is null then
    raise exception 'unsupported general question coverage source';
  end if;
  v_evidence_method := case v_source_name
    when 'general_question_pdf' then 'parser'
    else 'manual'
  end;
  if exists (
    select 1 from public.general_question_staging_appearances staged
    where staged.batch_id = v_batch.id and staged.qa_status = 'pending'
  ) then return; end if;

  update public.general_question_import_batches set status = 'approved'
  where id = v_batch.id and status = 'awaiting_review';
  update public.general_question_import_batches set status = 'applied'
  where id = v_batch.id and status = 'approved';

  with active_batches as (
    select distinct on (version.ingestion_source_id) batch.*
    from public.general_question_import_batches batch
    join public.ingestion_source_versions version
      on version.id = batch.source_version_id
    join public.ingestion_sources source
      on source.id = version.ingestion_source_id
    where batch.council_session_id = v_batch.council_session_id
      and source.source = v_source_name
      and batch.status = 'applied'
      and exists (
        select 1
        from public.general_question_staging_appearances staged
        join public.general_question_staging_applications application
          on application.staging_id = staged.id
        where staged.batch_id = batch.id
      )
    order by version.ingestion_source_id, batch.created_at desc, batch.id desc
  )
  select coalesce(sum(batch.discovered_count), 0)::integer
  into v_expected_count
  from active_batches batch;
  with active_batches as (
    select distinct on (version.ingestion_source_id) batch.*
    from public.general_question_import_batches batch
    join public.ingestion_source_versions version
      on version.id = batch.source_version_id
    join public.ingestion_sources source
      on source.id = version.ingestion_source_id
    where batch.council_session_id = v_batch.council_session_id
      and source.source = v_source_name
      and batch.status = 'applied'
      and exists (
        select 1
        from public.general_question_staging_appearances staged
        join public.general_question_staging_applications application
          on application.staging_id = staged.id
        where staged.batch_id = batch.id
      )
    order by version.ingestion_source_id, batch.created_at desc, batch.id desc
  )
  select count(application.id)::integer
  into v_matched_count
  from active_batches batch
  join public.general_question_staging_appearances staged
    on staged.batch_id = batch.id
  join public.general_question_staging_applications application
    on application.staging_id = staged.id
  where batch.council_session_id = v_batch.council_session_id
    and batch.status = 'applied';
  if v_matched_count = 0 then return; end if;

  insert into public.general_question_session_coverage (
    council_session_id, source_kind
  ) values (v_batch.council_session_id, v_coverage_kind)
  on conflict (council_session_id, source_kind) do update
    set source_kind = excluded.source_kind
  returning id into v_coverage_id;

  update public.general_question_session_coverage_observations
  set publication_state = 'superseded'
  where coverage_id = v_coverage_id and publication_state = 'published';
  insert into public.general_question_session_coverage_observations (
    coverage_id, council_session_id, source_kind, observation_key,
    state, record_presence, session_disposition, expected_count,
    matched_count, checked_at
  ) values (
    v_coverage_id, v_batch.council_session_id, v_coverage_kind,
    'aggregate:' || gen_random_uuid()::text,
    (case when v_expected_count = v_matched_count then 'collected'
      else 'partial' end)::public.coverage_state_enum,
    'present', 'held', v_expected_count, v_matched_count, now()
  ) returning id into v_observation_id;

  for v_source in
    with active_batches as (
      select distinct on (version.ingestion_source_id) batch.*,
        version.ingestion_source_id
      from public.general_question_import_batches batch
      join public.ingestion_source_versions version
        on version.id = batch.source_version_id
      join public.ingestion_sources source
        on source.id = version.ingestion_source_id
      where batch.council_session_id = v_batch.council_session_id
        and source.source = v_source_name
        and batch.status = 'applied'
        and exists (
          select 1
          from public.general_question_staging_appearances staged
          join public.general_question_staging_applications application
            on application.staging_id = staged.id
          where staged.batch_id = batch.id
        )
      order by version.ingestion_source_id, batch.created_at desc, batch.id desc
    )
    select batch.id batch_id, batch.source_version_id,
      batch.parse_run_id, batch.ingestion_source_id
    from active_batches batch
  loop
    insert into public.general_question_session_coverage_source_occurrences (
      coverage_id, council_session_id, source_kind, ingestion_source_id,
      source_coverage_key
    ) values (
      v_coverage_id, v_batch.council_session_id, v_coverage_kind,
      v_source.ingestion_source_id, 'batch:' || v_source.batch_id::text
    ) on conflict (ingestion_source_id, source_coverage_key) do update
      set source_coverage_key = excluded.source_coverage_key
    returning id into v_occurrence_id;
    insert into public.general_question_session_coverage_observation_sources (
      observation_id, coverage_id, council_session_id, source_kind,
      coverage_source_occurrence_id, ingestion_source_id, source_version_id,
      parse_run_id, evidence_role, source_locator, extraction_method,
      qa_status, verified_by, verified_at
    ) values (
      v_observation_id, v_coverage_id, v_batch.council_session_id,
      v_coverage_kind, v_occurrence_id, v_source.ingestion_source_id,
      v_source.source_version_id,
      case when v_evidence_method = 'parser' then v_source.parse_run_id end,
      'primary', 'batch=' || v_source.batch_id::text, v_evidence_method,
      'verified',
      p_reviewed_by, now()
    );
  end loop;
  update public.general_question_session_coverage_observations
  set qa_status = 'verified', reviewed_by = p_reviewed_by, reviewed_at = now()
  where id = v_observation_id;
  update public.general_question_session_coverage_observations
  set publication_state = 'reviewed' where id = v_observation_id;
  update public.general_question_session_coverage_observations
  set publication_state = 'published' where id = v_observation_id;
end;
$$;

revoke all on function refresh_general_question_batch_publication(uuid, uuid)
from public, anon, authenticated;
grant execute on function refresh_general_question_batch_publication(uuid, uuid)
to service_role;
