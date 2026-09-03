-- Staging and human QA queue for parsed general-question documents.

create type general_question_import_status_enum as enum (
  'running', 'awaiting_review', 'approved', 'applied', 'failed'
);
create type general_question_change_kind_enum as enum (
  'new', 'changed', 'unchanged', 'missing', 'ambiguous'
);

create table general_question_import_batches (
  id uuid primary key default gen_random_uuid(),
  parse_run_id uuid not null references ingestion_parse_runs(id) on delete restrict,
  source_version_id uuid not null references ingestion_source_versions(id)
    on delete restrict,
  council_session_id uuid references council_sessions(id) on delete restrict,
  status general_question_import_status_enum not null default 'running',
  discovered_count integer not null default 0 check (discovered_count >= 0),
  staged_count integer not null default 0 check (staged_count >= 0),
  error_details jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (parse_run_id),
  foreign key (parse_run_id, source_version_id)
    references ingestion_parse_runs(id, source_version_id) on delete restrict,
  check (
    (status = 'running' and finished_at is null)
    or (status <> 'running' and finished_at is not null)
  )
);

create table general_question_staging_appearances (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references general_question_import_batches(id)
    on delete restrict,
  source_appearance_key text not null
    check (nullif(btrim(source_appearance_key), '') is not null),
  content_fingerprint text not null
    check (nullif(btrim(content_fingerprint), '') is not null),
  change_kind general_question_change_kind_enum not null,
  matched_appearance_id uuid references general_question_appearances(id)
    on delete restrict,
  reviewed_matched_appearance_id uuid references general_question_appearances(id)
    on delete restrict,
  reviewed_match_confirmed boolean not null default false,
  parsed_payload jsonb not null check (jsonb_typeof(parsed_payload) = 'object'),
  generated_public_summaries jsonb not null default '{}'::jsonb
    constraint general_question_staging_generated_summaries_check
    check (jsonb_typeof(generated_public_summaries) = 'object'),
  summary_generation_model text,
  summary_prompt_version text,
  summary_generated_at timestamptz,
  reviewed_public_summaries jsonb not null default '{}'::jsonb
    constraint general_question_staging_reviewed_summaries_check
    check (jsonb_typeof(reviewed_public_summaries) = 'object'),
  reviewed_held_on date,
  qa_status qa_status_enum not null default 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (qa_status = 'pending' or reviewed_by is not null),
  constraint general_question_staging_summary_metadata_check check (
    (summary_generation_model is null and summary_prompt_version is null
      and summary_generated_at is null)
    or (nullif(btrim(summary_generation_model), '') is not null
      and nullif(btrim(summary_prompt_version), '') is not null
      and summary_generated_at is not null)
  ),
  check (
    (change_kind in ('changed', 'unchanged', 'missing')
      and matched_appearance_id is not null)
    or (change_kind in ('new', 'ambiguous'))
  ),
  unique (batch_id, source_appearance_key)
);

create index general_question_staging_qa_queue
  on general_question_staging_appearances (qa_status, change_kind, created_at);

alter table general_question_import_batches enable row level security;
alter table general_question_staging_appearances enable row level security;

create function enforce_general_question_import_batch_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(old.id, old.parse_run_id, old.source_version_id,
    old.council_session_id, old.created_at)
    is distinct from row(new.id, new.parse_run_id, new.source_version_id,
      new.council_session_id, new.created_at) then
    raise exception 'general question import batch identity is immutable';
  end if;
  if old.status <> 'running' and new.status = 'running' then
    raise exception 'general question import batch cannot return to running';
  end if;
  if old.status in ('applied', 'failed') and old is distinct from new then
    raise exception 'terminal general question import batch is immutable';
  end if;
  return new;
end;
$$;

create function enforce_general_question_staging_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(old) - array[
    'qa_status', 'review_note', 'reviewed_by', 'reviewed_at',
    'reviewed_held_on', 'reviewed_matched_appearance_id',
    'reviewed_match_confirmed',
    'generated_public_summaries', 'summary_generation_model',
    'summary_prompt_version', 'summary_generated_at',
    'reviewed_public_summaries'
  ]) is distinct from (to_jsonb(new) - array[
    'qa_status', 'review_note', 'reviewed_by', 'reviewed_at',
    'reviewed_held_on', 'reviewed_matched_appearance_id',
    'reviewed_match_confirmed',
    'generated_public_summaries', 'summary_generation_model',
    'summary_prompt_version', 'summary_generated_at',
    'reviewed_public_summaries'
  ]) then
    raise exception 'staged parser output is immutable';
  end if;
  if old.qa_status <> 'pending' and old is distinct from new then
    raise exception 'reviewed staging row is immutable';
  end if;
  return new;
end;
$$;

create trigger general_question_import_batches_controlled_update
before update on general_question_import_batches
for each row execute function enforce_general_question_import_batch_update();
create trigger general_question_staging_controlled_update
before update on general_question_staging_appearances
for each row execute function enforce_general_question_staging_update();

revoke delete, truncate on general_question_import_batches,
  general_question_staging_appearances from anon, authenticated, service_role;
revoke all on function enforce_general_question_import_batch_update(),
  enforce_general_question_staging_update()
  from public, anon, authenticated, service_role;
