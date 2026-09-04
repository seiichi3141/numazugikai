-- 財政資料の解析結果を公開前に確認するためのstaging基盤。

create type fiscal_import_status_enum as enum (
  'running', 'awaiting_review', 'approved', 'applied', 'failed'
);
create type fiscal_staging_record_kind_enum as enum (
  'document_metadata',
  'scope_membership',
  'coverage',
  'classification',
  'classification_mapping',
  'amount',
  'bill_link'
);
create type fiscal_staging_change_kind_enum as enum (
  'new', 'changed', 'unchanged', 'missing', 'ambiguous'
);

create table fiscal_import_batches (
  id uuid primary key default gen_random_uuid(),
  parse_run_id uuid not null references ingestion_parse_runs(id)
    on delete restrict,
  source_version_id uuid not null references ingestion_source_versions(id)
    on delete restrict,
  source_kind fiscal_source_kind_enum not null,
  profile_key text not null check (nullif(btrim(profile_key), '') is not null),
  profile_version text not null
    check (nullif(btrim(profile_version), '') is not null),
  fiscal_year smallint,
  status fiscal_import_status_enum not null default 'running',
  discovered_count integer not null default 0
    check (discovered_count >= 0),
  staged_count integer not null default 0 check (staged_count >= 0),
  hard_error_count integer not null default 0
    check (hard_error_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  validation_summary jsonb not null default '[]'::jsonb
    check (jsonb_typeof(validation_summary) = 'array'),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (parse_run_id),
  unique (id, source_version_id, parse_run_id),
  foreign key (parse_run_id, source_version_id)
    references ingestion_parse_runs(id, source_version_id) on delete restrict,
  check (
    (status = 'running' and finished_at is null)
    or (status <> 'running' and finished_at is not null)
  ),
  check (finished_at is null or finished_at >= created_at)
);

create table fiscal_staging_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references fiscal_import_batches(id)
    on delete restrict,
  record_kind fiscal_staging_record_kind_enum not null,
  source_record_key text not null
    check (nullif(btrim(source_record_key), '') is not null),
  content_fingerprint text not null
    check (nullif(btrim(content_fingerprint), '') is not null),
  change_kind fiscal_staging_change_kind_enum not null,
  matched_target_id uuid,
  parsed_payload jsonb not null check (jsonb_typeof(parsed_payload) = 'object'),
  validation_results jsonb not null default '[]'::jsonb
    check (jsonb_typeof(validation_results) = 'array'),
  qa_status qa_status_enum not null default 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (qa_status = 'pending' or reviewed_by is not null),
  check (
    (change_kind in ('changed', 'unchanged', 'missing')
      and matched_target_id is not null)
    or change_kind in ('new', 'ambiguous')
  ),
  unique (batch_id, record_kind, source_record_key)
);

create index fiscal_import_batches_review_queue
  on fiscal_import_batches (status, created_at desc);
create index fiscal_staging_records_review_queue
  on fiscal_staging_records (qa_status, record_kind, created_at);

create view fiscal_import_batch_qa_counts
with (security_invoker = true)
as
select
  batch.id as batch_id,
  count(record.id) filter (where record.qa_status = 'pending')::integer
    as pending_count,
  coalesce((
    select jsonb_agg(validation.item)
    from (
      select item
      from jsonb_array_elements(batch.validation_summary) item
      union all
      select item
      from fiscal_staging_records message_record
      cross join lateral jsonb_array_elements(
        message_record.validation_results
      ) item
      where message_record.batch_id = batch.id
      limit 20
    ) validation
  ), '[]'::jsonb) as validation_messages
from fiscal_import_batches batch
left join fiscal_staging_records record on record.batch_id = batch.id
group by batch.id;

create function enforce_fiscal_import_batch_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    old.id, old.parse_run_id, old.source_version_id, old.source_kind,
    old.profile_key, old.profile_version, old.fiscal_year,
    old.discovered_count, old.staged_count, old.hard_error_count,
    old.warning_count, old.validation_summary, old.created_at
  ) is distinct from row(
    new.id, new.parse_run_id, new.source_version_id, new.source_kind,
    new.profile_key, new.profile_version, new.fiscal_year,
    new.discovered_count, new.staged_count, new.hard_error_count,
    new.warning_count, new.validation_summary, new.created_at
  ) then
    raise exception 'fiscal import batch parser result is immutable';
  end if;
  if old.finished_at is distinct from new.finished_at and not (
    old.status = 'running'
    and new.status in ('awaiting_review', 'failed')
    and old.finished_at is null
    and new.finished_at is not null
  ) then
    raise exception 'fiscal import batch finished time is immutable';
  end if;
  if old.status <> new.status and not (
    (old.status = 'running' and new.status in ('awaiting_review', 'failed'))
    or (old.status = 'awaiting_review' and new.status = 'approved')
    or (old.status = 'approved' and new.status = 'applied')
  ) then
    raise exception 'invalid fiscal import batch status transition';
  end if;
  return new;
end;
$$;

create function enforce_fiscal_staging_record_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(old) - array[
    'qa_status', 'review_note', 'reviewed_by', 'reviewed_at'
  ]) is distinct from (to_jsonb(new) - array[
    'qa_status', 'review_note', 'reviewed_by', 'reviewed_at'
  ]) then
    raise exception 'fiscal staged parser output is immutable';
  end if;
  if old.qa_status <> 'pending' and old is distinct from new then
    raise exception 'reviewed fiscal staging record is immutable';
  end if;
  return new;
end;
$$;

create trigger fiscal_import_batches_controlled_update
before update on fiscal_import_batches
for each row execute function enforce_fiscal_import_batch_update();
create trigger fiscal_staging_records_controlled_update
before update on fiscal_staging_records
for each row execute function enforce_fiscal_staging_record_update();

create function save_fiscal_staging(
  p_source_version_id uuid,
  p_parse_run_id uuid,
  p_source_kind fiscal_source_kind_enum,
  p_profile_key text,
  p_profile_version text,
  p_fiscal_year smallint,
  p_rows jsonb,
  p_discovered_count integer,
  p_validation_summary jsonb default '[]'::jsonb,
  p_parse_status ingestion_parse_status_enum default 'completed',
  p_finished_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_id uuid;
  hard_errors integer;
  warnings integer;
begin
  if p_parse_status not in ('completed', 'failed') then
    raise exception 'fiscal staging requires completed or failed parse status';
  end if;
  if p_finished_at is null or p_discovered_count < 0
    or nullif(btrim(p_profile_key), '') is null
    or nullif(btrim(p_profile_version), '') is null then
    raise exception 'invalid fiscal staging metadata';
  end if;
  if jsonb_typeof(p_rows) <> 'array'
    or jsonb_typeof(p_validation_summary) <> 'array' then
    raise exception 'fiscal staging rows and validation summary must be arrays';
  end if;

  select
    count(*) filter (where item->>'severity' = 'hard_error'),
    count(*) filter (where item->>'severity' = 'warning')
  into hard_errors, warnings
  from (
    select item from jsonb_array_elements(p_validation_summary) item
    union all
    select item
    from jsonb_array_elements(p_rows) row_data
    cross join lateral jsonb_array_elements(
      coalesce(row_data->'validation_results', '[]'::jsonb)
    ) item
  ) validations;

  insert into public.fiscal_import_batches (
    parse_run_id, source_version_id, source_kind, profile_key,
    profile_version, fiscal_year, status, discovered_count, staged_count,
    hard_error_count, warning_count, validation_summary, finished_at
  ) values (
    p_parse_run_id, p_source_version_id, p_source_kind, p_profile_key,
    p_profile_version, p_fiscal_year,
    case
      when p_parse_status = 'failed' then 'failed'::public.fiscal_import_status_enum
      else 'awaiting_review'::public.fiscal_import_status_enum
    end,
    p_discovered_count, jsonb_array_length(p_rows), hard_errors, warnings,
    p_validation_summary, p_finished_at
  ) returning id into batch_id;

  insert into public.fiscal_staging_records (
    batch_id, record_kind, source_record_key, content_fingerprint,
    change_kind, matched_target_id, parsed_payload, validation_results
  )
  select
    batch_id,
    row_data.record_kind::public.fiscal_staging_record_kind_enum,
    row_data.source_record_key,
    row_data.content_fingerprint,
    row_data.change_kind::public.fiscal_staging_change_kind_enum,
    row_data.matched_target_id,
    row_data.parsed_payload,
    coalesce(row_data.validation_results, '[]'::jsonb)
  from jsonb_to_recordset(p_rows) as row_data(
    record_kind text,
    source_record_key text,
    content_fingerprint text,
    change_kind text,
    matched_target_id uuid,
    parsed_payload jsonb,
    validation_results jsonb
  );

  perform public.finalize_ingestion_parse_run(
    p_parse_run_id,
    p_parse_status,
    jsonb_build_object(
      'discoveredCount', p_discovered_count,
      'stagedCount', jsonb_array_length(p_rows),
      'hardErrorCount', hard_errors,
      'warningCount', warnings,
      'validationSummary', p_validation_summary
    ),
    p_finished_at
  );

  return batch_id;
end;
$$;

alter table fiscal_import_batches enable row level security;
alter table fiscal_staging_records enable row level security;

revoke delete, truncate on fiscal_import_batches, fiscal_staging_records
  from anon, authenticated, service_role;
revoke all on fiscal_import_batch_qa_counts from public, anon, authenticated;
grant select on fiscal_import_batch_qa_counts to service_role;
revoke all on function enforce_fiscal_import_batch_update(),
  enforce_fiscal_staging_record_update()
  from public, anon, authenticated, service_role;
revoke all on function save_fiscal_staging(
  uuid, uuid, fiscal_source_kind_enum, text, text, smallint, jsonb,
  integer, jsonb, ingestion_parse_status_enum, timestamptz
) from public, anon, authenticated;
grant execute on function save_fiscal_staging(
  uuid, uuid, fiscal_source_kind_enum, text, text, smallint, jsonb,
  integer, jsonb, ingestion_parse_status_enum, timestamptz
) to service_role;

comment on table fiscal_import_batches is
  '取得版とparser設定を固定し、財政解析の件数・検算結果を公開前に確認する単位。';
comment on table fiscal_staging_records is
  '公開正本へ反映する前の財政解析候補。parser出力は不変で、QA情報だけを更新できる。';
