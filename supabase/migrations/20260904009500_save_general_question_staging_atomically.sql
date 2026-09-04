-- Persist a parsed general-question batch and finalize its parse run atomically.

create function public.save_general_question_staging(
  p_source_version_id uuid,
  p_parse_run_id uuid,
  p_rows jsonb,
  p_discovered_count integer,
  p_validation_errors jsonb default '[]'::jsonb,
  p_parse_status public.ingestion_parse_status_enum default 'completed',
  p_finished_at timestamptz default now(),
  p_council_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_id uuid;
begin
  if p_parse_status not in ('completed', 'failed') then
    raise exception 'general question staging requires completed or failed parse status';
  end if;
  if p_finished_at is null or p_discovered_count < 0 then
    raise exception 'invalid general question staging metadata';
  end if;
  if jsonb_typeof(p_rows) <> 'array'
    or jsonb_typeof(p_validation_errors) <> 'array' then
    raise exception 'general question staging rows and validation errors must be arrays';
  end if;

  insert into public.general_question_import_batches (
    parse_run_id,
    source_version_id,
    council_session_id,
    status,
    discovered_count,
    staged_count,
    error_details,
    finished_at
  ) values (
    p_parse_run_id,
    p_source_version_id,
    p_council_session_id,
    case
      when p_parse_status = 'failed' then
        'failed'::public.general_question_import_status_enum
      else 'awaiting_review'::public.general_question_import_status_enum
    end,
    p_discovered_count,
    jsonb_array_length(p_rows),
    case
      when jsonb_array_length(p_validation_errors) > 0 then
        jsonb_build_object('validationErrors', p_validation_errors)
      else null
    end,
    p_finished_at
  )
  returning id into batch_id;

  insert into public.general_question_staging_appearances (
    batch_id,
    source_appearance_key,
    content_fingerprint,
    change_kind,
    matched_appearance_id,
    parsed_payload
  )
  select
    batch_id,
    row.source_appearance_key,
    row.content_fingerprint,
    row.change_kind::public.general_question_change_kind_enum,
    row.matched_appearance_id,
    row.parsed_payload
  from jsonb_to_recordset(p_rows) as row(
    source_appearance_key text,
    content_fingerprint text,
    change_kind text,
    matched_appearance_id uuid,
    parsed_payload jsonb
  );

  perform public.finalize_ingestion_parse_run(
    p_parse_run_id,
    p_parse_status,
    jsonb_build_object(
      'appearanceCount', p_discovered_count,
      'stagedCount', jsonb_array_length(p_rows),
      'validationErrors', p_validation_errors
    ),
    p_finished_at
  );

  return batch_id;
end;
$$;

revoke all on function public.save_general_question_staging(
  uuid,
  uuid,
  jsonb,
  integer,
  jsonb,
  public.ingestion_parse_status_enum,
  timestamptz,
  uuid
) from public, anon, authenticated;
grant execute on function public.save_general_question_staging(
  uuid,
  uuid,
  jsonb,
  integer,
  jsonb,
  public.ingestion_parse_status_enum,
  timestamptz,
  uuid
) to service_role;
