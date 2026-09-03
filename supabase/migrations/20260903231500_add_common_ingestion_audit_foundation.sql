-- Common ingestion audit foundation (Phase 0A).
-- This migration is shared by all council-data visualization features.

create type coverage_state_enum as enum (
  'uncollected',
  'source_not_published',
  'source_unavailable',
  'not_applicable',
  'partial',
  'collected',
  'error'
);

create type record_presence_enum as enum ('present', 'absent', 'unknown');
create type qa_status_enum as enum ('pending', 'verified', 'rejected');
create type extraction_method_enum as enum ('parser', 'manual');
create type publication_state_enum as enum (
  'draft',
  'reviewed',
  'published',
  'superseded'
);

create type source_artifact_retention_state_enum as enum (
  'pending',
  'retained',
  'expired',
  'not_permitted'
);

create type ingestion_parse_status_enum as enum (
  'running',
  'completed',
  'failed',
  'rejected'
);

create table ingestion_source_versions (
  id uuid primary key default gen_random_uuid(),
  ingestion_source_id uuid not null
    references ingestion_sources(id) on delete restrict,
  content_hash text not null check (nullif(btrim(content_hash), '') is not null),
  fetched_at timestamptz not null,
  source_title text,
  published_at timestamptz,
  as_of_date date,
  etag text,
  last_modified text,
  media_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  private_object_key text,
  artifact_retention_state source_artifact_retention_state_enum not null
    default 'pending',
  reparse_available_until timestamptz,
  created_at timestamptz not null default now(),
  check (
    (artifact_retention_state = 'retained'
      and nullif(btrim(private_object_key), '') is not null)
    or (artifact_retention_state <> 'retained' and private_object_key is null)
  ),
  unique (ingestion_source_id, content_hash),
  unique (id, ingestion_source_id)
);

create table ingestion_parse_runs (
  id uuid primary key default gen_random_uuid(),
  ingestion_run_id uuid not null references ingestion_runs(id) on delete restrict,
  source_version_id uuid not null
    references ingestion_source_versions(id) on delete restrict,
  parser_name text not null check (nullif(btrim(parser_name), '') is not null),
  parser_version text not null
    check (nullif(btrim(parser_version), '') is not null),
  configuration_hash text not null
    check (nullif(btrim(configuration_hash), '') is not null),
  status ingestion_parse_status_enum not null default 'running',
  parse_stats jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check (
    (status = 'running' and finished_at is null and parse_stats is null)
    or (status in ('completed', 'failed', 'rejected') and finished_at is not null)
  ),
  check (finished_at is null or finished_at >= started_at),
  unique (
    ingestion_run_id,
    source_version_id,
    parser_name,
    parser_version,
    configuration_hash
  ),
  unique (id, source_version_id)
);

create unique index ingestion_parse_runs_completed_profile_key
  on ingestion_parse_runs (
    source_version_id,
    parser_name,
    parser_version,
    configuration_hash
  )
  where status = 'completed';

create table source_artifact_consumer_types (
  consumer_type text primary key,
  description text not null,
  registered_by_migration text not null,
  created_at timestamptz not null default now(),
  check (nullif(btrim(consumer_type), '') is not null),
  check (nullif(btrim(description), '') is not null),
  check (nullif(btrim(registered_by_migration), '') is not null)
);

create table published_source_version_references (
  id uuid primary key default gen_random_uuid(),
  consumer_type text not null
    references source_artifact_consumer_types(consumer_type) on delete restrict,
  consumer_id uuid not null,
  evidence_table text not null,
  evidence_id uuid not null,
  source_version_id uuid not null
    references ingestion_source_versions(id) on delete restrict,
  activated_at timestamptz not null default now(),
  released_at timestamptz,
  check (nullif(btrim(evidence_table), '') is not null),
  check (released_at is null or released_at >= activated_at)
);

create unique index published_source_version_references_one_active
  on published_source_version_references (
    consumer_type,
    consumer_id,
    evidence_table,
    evidence_id,
    source_version_id
  )
  where released_at is null;

create index published_source_version_references_active_source_version
  on published_source_version_references (source_version_id)
  where released_at is null;

create table ingestion_source_version_retention_transitions (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null
    references ingestion_source_versions(id) on delete restrict,
  from_state source_artifact_retention_state_enum not null,
  to_state source_artifact_retention_state_enum not null,
  from_private_object_key text,
  to_private_object_key text,
  from_reparse_available_until timestamptz,
  to_reparse_available_until timestamptz,
  changed_by uuid not null,
  reason text not null check (nullif(btrim(reason), '') is not null),
  changed_at timestamptz not null default now()
);

create function enforce_ingestion_source_identity_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(old.id, old.source, old.url, old.created_at)
    is distinct from row(new.id, new.source, new.url, new.created_at) then
    raise exception 'ingestion source identity is immutable';
  end if;
  return new;
end;
$$;

create trigger ingestion_sources_identity_immutable
before update on ingestion_sources
for each row execute function enforce_ingestion_source_identity_update();

create function prevent_ingestion_source_removal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ingestion sources are append-only';
end;
$$;

create trigger ingestion_sources_no_delete
before delete on ingestion_sources
for each row execute function prevent_ingestion_source_removal();

create trigger ingestion_sources_no_truncate
before truncate on ingestion_sources
for each statement execute function prevent_ingestion_source_removal();

create function enforce_ingestion_source_version_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.artifact_retention_state <> 'pending'
    or new.private_object_key is not null
    or new.reparse_available_until is not null then
    raise exception 'source version must be inserted with pending retention';
  end if;
  return new;
end;
$$;

create trigger ingestion_source_versions_start_pending
before insert on ingestion_source_versions
for each row execute function enforce_ingestion_source_version_insert();

create function enforce_ingestion_source_version_identity_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    old.id,
    old.ingestion_source_id,
    old.content_hash,
    old.fetched_at,
    old.source_title,
    old.published_at,
    old.as_of_date,
    old.etag,
    old.last_modified,
    old.media_type,
    old.byte_size,
    old.created_at
  ) is distinct from row(
    new.id,
    new.ingestion_source_id,
    new.content_hash,
    new.fetched_at,
    new.source_title,
    new.published_at,
    new.as_of_date,
    new.etag,
    new.last_modified,
    new.media_type,
    new.byte_size,
    new.created_at
  ) then
    raise exception 'ingestion source version identity is immutable';
  end if;
  return new;
end;
$$;

create trigger ingestion_source_versions_identity_immutable
before update on ingestion_source_versions
for each row execute function enforce_ingestion_source_version_identity_update();

create function enforce_source_version_reference_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.released_at is not null then
    raise exception 'source version reference must be inserted active';
  end if;

  perform 1
  from public.ingestion_source_versions source_version
  where source_version.id = new.source_version_id
    and source_version.artifact_retention_state = 'retained'
    and nullif(btrim(source_version.private_object_key), '') is not null
  for update;

  if not found then
    raise exception 'published parser evidence requires a retained artifact';
  end if;
  return new;
end;
$$;

create function enforce_source_version_reference_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    old.id,
    old.consumer_type,
    old.consumer_id,
    old.evidence_table,
    old.evidence_id,
    old.source_version_id,
    old.activated_at
  ) is distinct from row(
    new.id,
    new.consumer_type,
    new.consumer_id,
    new.evidence_table,
    new.evidence_id,
    new.source_version_id,
    new.activated_at
  ) then
    raise exception 'source version reference identity is immutable';
  end if;
  if old.released_at is not null
    or new.released_at is null
    or new.released_at < old.activated_at then
    raise exception 'source version reference may be released once';
  end if;
  return new;
end;
$$;

create trigger published_source_version_references_insert_active
before insert on published_source_version_references
for each row execute function enforce_source_version_reference_insert();

create trigger published_source_version_references_release_once
before update on published_source_version_references
for each row execute function enforce_source_version_reference_update();

create function transition_ingestion_source_version_retention(
  p_source_version_id uuid,
  p_to_state source_artifact_retention_state_enum,
  p_changed_by uuid,
  p_reason text,
  p_private_object_key text default null,
  p_reparse_available_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.ingestion_source_versions%rowtype;
begin
  if p_changed_by is null or nullif(btrim(p_reason), '') is null then
    raise exception 'retention transition requires actor and reason';
  end if;
  select *
  into previous
  from public.ingestion_source_versions
  where id = p_source_version_id
  for update;

  if not found then
    raise exception 'source version not found';
  end if;
  if row(
    previous.artifact_retention_state,
    previous.private_object_key,
    previous.reparse_available_until
  ) is not distinct from row(
    p_to_state,
    p_private_object_key,
    p_reparse_available_until
  ) then
    raise exception 'retention transition must change retention data';
  end if;

  update public.ingestion_source_versions
  set artifact_retention_state = p_to_state,
      private_object_key = p_private_object_key,
      reparse_available_until = p_reparse_available_until
  where id = p_source_version_id;

  insert into public.ingestion_source_version_retention_transitions (
    source_version_id,
    from_state,
    to_state,
    from_private_object_key,
    to_private_object_key,
    from_reparse_available_until,
    to_reparse_available_until,
    changed_by,
    reason
  ) values (
    p_source_version_id,
    previous.artifact_retention_state,
    p_to_state,
    previous.private_object_key,
    p_private_object_key,
    previous.reparse_available_until,
    p_reparse_available_until,
    p_changed_by,
    p_reason
  );
end;
$$;

create function ingestion_source_version_retention_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.artifact_retention_state = 'retained'
    and (
      new.artifact_retention_state <> 'retained'
      or new.private_object_key is distinct from old.private_object_key
    )
    and exists (
      select 1
      from public.published_source_version_references reference
      where reference.source_version_id = new.id
        and reference.released_at is null
    ) then
    raise exception 'active published evidence requires the retained artifact';
  end if;
  return null;
end;
$$;

create constraint trigger ingestion_source_version_retention_is_referenced
after update of artifact_retention_state, private_object_key
on ingestion_source_versions
deferrable initially deferred
for each row execute function ingestion_source_version_retention_guard();

create function prevent_ingestion_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only; this operation is prohibited', tg_table_name;
end;
$$;

create trigger ingestion_source_versions_no_delete
before delete on ingestion_source_versions
for each row execute function prevent_ingestion_audit_mutation();

create trigger ingestion_source_versions_no_truncate
before truncate on ingestion_source_versions
for each statement execute function prevent_ingestion_audit_mutation();

create trigger ingestion_source_version_retention_transitions_no_delete
before delete on ingestion_source_version_retention_transitions
for each row execute function prevent_ingestion_audit_mutation();

create trigger ingestion_source_version_retention_transitions_no_update
before update on ingestion_source_version_retention_transitions
for each row execute function prevent_ingestion_audit_mutation();

create trigger ingestion_source_version_retention_transitions_no_truncate
before truncate on ingestion_source_version_retention_transitions
for each statement execute function prevent_ingestion_audit_mutation();

create trigger source_artifact_consumer_types_no_delete
before delete on source_artifact_consumer_types
for each row execute function prevent_ingestion_audit_mutation();

create trigger source_artifact_consumer_types_no_update
before update on source_artifact_consumer_types
for each row execute function prevent_ingestion_audit_mutation();

create trigger source_artifact_consumer_types_no_truncate
before truncate on source_artifact_consumer_types
for each statement execute function prevent_ingestion_audit_mutation();

create trigger published_source_version_references_no_delete
before delete on published_source_version_references
for each row execute function prevent_ingestion_audit_mutation();

create trigger published_source_version_references_no_truncate
before truncate on published_source_version_references
for each statement execute function prevent_ingestion_audit_mutation();

create function enforce_ingestion_parse_run_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'running'
    or new.finished_at is not null
    or new.parse_stats is not null then
    raise exception 'parse run must be inserted as running';
  end if;
  return new;
end;
$$;

create trigger ingestion_parse_runs_insert_running
before insert on ingestion_parse_runs
for each row execute function enforce_ingestion_parse_run_insert();

create function enforce_ingestion_parse_run_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    old.id,
    old.ingestion_run_id,
    old.source_version_id,
    old.parser_name,
    old.parser_version,
    old.configuration_hash,
    old.started_at
  ) is distinct from row(
    new.id,
    new.ingestion_run_id,
    new.source_version_id,
    new.parser_name,
    new.parser_version,
    new.configuration_hash,
    new.started_at
  ) then
    raise exception 'parse run identity is immutable';
  end if;
  if old.status <> 'running' then
    raise exception 'terminal parse run is immutable';
  end if;
  if new.status = 'running' or new.finished_at is null then
    raise exception 'parse run update must finalize the run';
  end if;
  return new;
end;
$$;

create trigger ingestion_parse_runs_finalize_once
before update on ingestion_parse_runs
for each row execute function enforce_ingestion_parse_run_update();

create trigger ingestion_parse_runs_no_delete
before delete on ingestion_parse_runs
for each row execute function prevent_ingestion_audit_mutation();

create trigger ingestion_parse_runs_no_truncate
before truncate on ingestion_parse_runs
for each statement execute function prevent_ingestion_audit_mutation();

create function finalize_ingestion_parse_run(
  p_parse_run_id uuid,
  p_status ingestion_parse_status_enum,
  p_parse_stats jsonb,
  p_finished_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if p_status not in ('completed', 'failed', 'rejected')
    or p_finished_at is null then
    raise exception 'invalid terminal parse status';
  end if;

  update public.ingestion_parse_runs
  set status = p_status,
      parse_stats = p_parse_stats,
      finished_at = p_finished_at
  where id = p_parse_run_id
    and status = 'running';

  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'parse run was not running';
  end if;
end;
$$;

alter table ingestion_sources enable row level security;
alter table ingestion_source_versions enable row level security;
alter table ingestion_parse_runs enable row level security;
alter table ingestion_source_version_retention_transitions
  enable row level security;
alter table source_artifact_consumer_types enable row level security;
alter table published_source_version_references enable row level security;

revoke delete, truncate on ingestion_sources
  from anon, authenticated, service_role;
revoke update, delete, truncate
  on ingestion_source_versions, ingestion_parse_runs
  from anon, authenticated, service_role;
revoke insert, update, delete, truncate
  on ingestion_source_version_retention_transitions
  from anon, authenticated, service_role;
revoke insert, update, delete, truncate
  on source_artifact_consumer_types, published_source_version_references
  from anon, authenticated, service_role;

revoke all on function enforce_ingestion_source_identity_update(),
  prevent_ingestion_source_removal(),
  enforce_ingestion_source_version_insert(),
  enforce_ingestion_source_version_identity_update(),
  enforce_source_version_reference_insert(),
  enforce_source_version_reference_update(),
  ingestion_source_version_retention_guard(),
  prevent_ingestion_audit_mutation(),
  enforce_ingestion_parse_run_insert(),
  enforce_ingestion_parse_run_update()
  from public, anon, authenticated, service_role;

revoke all on function transition_ingestion_source_version_retention(
  uuid,
  source_artifact_retention_state_enum,
  uuid,
  text,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function transition_ingestion_source_version_retention(
  uuid,
  source_artifact_retention_state_enum,
  uuid,
  text,
  text,
  timestamptz
) to service_role;

revoke all on function finalize_ingestion_parse_run(
  uuid,
  ingestion_parse_status_enum,
  jsonb,
  timestamptz
) from public, anon, authenticated;
grant execute on function finalize_ingestion_parse_run(
  uuid,
  ingestion_parse_status_enum,
  jsonb,
  timestamptz
) to service_role;

comment on table ingestion_source_versions is
  '取得した原資料の不変な各版。解析実行とは分離して保持する。';
comment on table ingestion_parse_runs is
  '取得版に対するパーサー実行履歴。runningから一度だけ終端状態へ遷移する。';
comment on table published_source_version_references is
  '公開中のparser根拠が依存する取得版の共通registry。';
