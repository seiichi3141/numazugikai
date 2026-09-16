-- Common council meeting foundation (Phase 0B).
-- Stable meetings are separated from normalized revisions and source evidence.

create type council_meeting_kind_enum as enum (
  'plenary',
  'committee',
  'steering',
  'all_members',
  'other'
);

create type council_meeting_status_enum as enum (
  'scheduled',
  'held',
  'cancelled',
  'unknown'
);

create type source_support_status_enum as enum (
  'official_supported',
  'empirical_verified',
  'partial',
  'unknown'
);

create type council_meeting_evidence_role_enum as enum (
  'schedule',
  'record',
  'video',
  'other'
);

create type source_availability_enum as enum (
  'available',
  'not_published',
  'unavailable'
);

create table council_meetings (
  id uuid primary key default gen_random_uuid(),
  canonical_meeting_key text not null unique
    check (nullif(btrim(canonical_meeting_key), '') is not null),
  created_at timestamptz not null default now()
);

create table council_meeting_revisions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references council_meetings(id) on delete restrict,
  revision_number integer not null check (revision_number >= 1),
  council_session_id uuid references council_sessions(id) on delete restrict,
  committee_id uuid references committees(id) on delete restrict,
  kind council_meeting_kind_enum not null,
  scheduled_on date,
  held_on date,
  day_number integer check (day_number is null or day_number >= 1),
  scheduled_starts_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  venue text,
  display_title text not null check (nullif(btrim(display_title), '') is not null),
  status council_meeting_status_enum not null,
  source_support_status source_support_status_enum not null default 'unknown',
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'held' and held_on is not null)
    or (status <> 'held' and held_on is null and opened_at is null
      and closed_at is null)
  ),
  check (status not in ('scheduled', 'cancelled') or scheduled_on is not null),
  check (closed_at is null or (opened_at is not null and closed_at >= opened_at)),
  check (
    (kind in ('committee', 'steering') and committee_id is not null)
    or (kind in ('plenary', 'all_members', 'other') and committee_id is null)
  ),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (qa_status <> 'verified' and publication_state = 'draft')
    or (qa_status = 'verified' and reviewed_by is not null)
  ),
  unique (meeting_id, revision_number),
  unique (id, meeting_id)
);

create unique index council_meeting_revisions_one_published
  on council_meeting_revisions (meeting_id)
  where publication_state = 'published';

create table council_meeting_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references council_meetings(id) on delete restrict,
  ingestion_source_id uuid not null
    references ingestion_sources(id) on delete restrict,
  source_occurrence_key text not null
    check (nullif(btrim(source_occurrence_key), '') is not null),
  source_system text not null check (nullif(btrim(source_system), '') is not null),
  external_id text,
  created_at timestamptz not null default now(),
  unique (ingestion_source_id, source_occurrence_key),
  unique (id, meeting_id, ingestion_source_id)
);

create unique index council_meeting_occurrences_external_identity
  on council_meeting_source_occurrences (source_system, external_id)
  where external_id is not null and nullif(btrim(external_id), '') is not null;

create table council_meeting_source_evidence (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null,
  meeting_source_occurrence_id uuid not null,
  source_version_id uuid not null,
  parse_run_id uuid,
  meeting_id uuid not null,
  ingestion_source_id uuid not null,
  role council_meeting_evidence_role_enum not null,
  source_evidence_key text not null
    check (nullif(btrim(source_evidence_key), '') is not null),
  evidence_revision integer not null default 1 check (evidence_revision >= 1),
  locator text,
  availability source_availability_enum not null default 'available',
  qa_status qa_status_enum not null default 'pending',
  extraction_method extraction_method_enum not null,
  verified_by uuid,
  verified_at timestamptz,
  observed_title text,
  observed_scheduled_on date,
  observed_held_on date,
  observed_day_number integer check (
    observed_day_number is null or observed_day_number >= 1
  ),
  observed_starts_at timestamptz,
  observed_opened_at timestamptz,
  observed_closed_at timestamptz,
  observed_venue text,
  observed_status council_meeting_status_enum,
  created_at timestamptz not null default now(),
  constraint council_meeting_evidence_revision_fk
    foreign key (revision_id, meeting_id)
    references council_meeting_revisions(id, meeting_id) on delete restrict,
  constraint council_meeting_evidence_occurrence_fk
    foreign key (
      meeting_source_occurrence_id,
      meeting_id,
      ingestion_source_id
    ) references council_meeting_source_occurrences(
      id,
      meeting_id,
      ingestion_source_id
    ) on delete restrict,
  constraint council_meeting_evidence_source_version_fk
    foreign key (source_version_id, ingestion_source_id)
    references ingestion_source_versions(id, ingestion_source_id)
    on delete restrict,
  constraint council_meeting_evidence_parse_run_fk
    foreign key (parse_run_id, source_version_id)
    references ingestion_parse_runs(id, source_version_id) on delete restrict,
  check (
    (extraction_method = 'parser' and parse_run_id is not null
      and evidence_revision = 1)
    or (extraction_method = 'manual' and parse_run_id is null)
  ),
  check ((verified_by is null) = (verified_at is null)),
  check (
    qa_status <> 'verified'
    or (
      availability = 'available'
      and verified_by is not null
      and (
        extraction_method <> 'manual'
        or nullif(btrim(locator), '') is not null
      )
    )
  ),
  check (
    observed_closed_at is null
    or (observed_opened_at is not null and observed_closed_at >= observed_opened_at)
  ),
  unique nulls not distinct (
    meeting_source_occurrence_id,
    source_version_id,
    parse_run_id,
    source_evidence_key,
    evidence_revision
  )
);

create index council_meeting_evidence_revision_qa
  on council_meeting_source_evidence (revision_id, qa_status, availability);

insert into source_artifact_consumer_types (
  consumer_type,
  description,
  registered_by_migration
) values (
  'common:council_meeting_revision',
  '公開中の会議revisionを支えるparser根拠',
  '20260903232000_add_common_council_meeting_foundation.sql'
);

create function prevent_council_meeting_identity_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'council meeting audit tables cannot be truncated';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'council meeting audit rows cannot be deleted';
  end if;
  if old is distinct from new then
    raise exception 'council meeting identity is immutable';
  end if;
  return new;
end;
$$;

create trigger council_meetings_immutable
before update or delete on council_meetings
for each row execute function prevent_council_meeting_identity_mutation();
create trigger council_meetings_no_truncate
before truncate on council_meetings
for each statement execute function prevent_council_meeting_identity_mutation();

create trigger council_meeting_occurrences_immutable
before update or delete on council_meeting_source_occurrences
for each row execute function prevent_council_meeting_identity_mutation();
create trigger council_meeting_occurrences_no_truncate
before truncate on council_meeting_source_occurrences
for each statement execute function prevent_council_meeting_identity_mutation();

create function enforce_council_meeting_revision_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    old.id, old.meeting_id, old.revision_number, old.council_session_id,
    old.committee_id, old.kind, old.scheduled_on, old.held_on,
    old.day_number, old.scheduled_starts_at, old.opened_at, old.closed_at,
    old.venue, old.display_title, old.status, old.source_support_status,
    old.created_at
  ) is distinct from row(
    new.id, new.meeting_id, new.revision_number, new.council_session_id,
    new.committee_id, new.kind, new.scheduled_on, new.held_on,
    new.day_number, new.scheduled_starts_at, new.opened_at, new.closed_at,
    new.venue, new.display_title, new.status, new.source_support_status,
    new.created_at
  ) then
    raise exception 'council meeting revision content is immutable';
  end if;

  if old.publication_state <> 'draft'
    and (
      new.qa_status <> 'verified'
      or new.reviewed_by is null
      or new.reviewed_at is null
    ) then
    raise exception 'review metadata cannot be removed after review';
  end if;

  if not (
    new.publication_state = old.publication_state
    or (old.publication_state = 'draft' and new.publication_state = 'reviewed')
    or (old.publication_state = 'reviewed' and new.publication_state = 'published')
    or (old.publication_state = 'published' and new.publication_state = 'superseded')
  ) then
    raise exception 'invalid council meeting publication transition';
  end if;
  return new;
end;
$$;

create trigger council_meeting_revisions_controlled_update
before update on council_meeting_revisions
for each row execute function enforce_council_meeting_revision_update();
create trigger council_meeting_revisions_no_delete
before delete on council_meeting_revisions
for each row execute function prevent_council_meeting_identity_mutation();
create trigger council_meeting_revisions_no_truncate
before truncate on council_meeting_revisions
for each statement execute function prevent_council_meeting_identity_mutation();

create function enforce_council_meeting_evidence_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    old.id, old.revision_id, old.meeting_source_occurrence_id,
    old.source_version_id, old.parse_run_id, old.meeting_id,
    old.ingestion_source_id, old.role, old.source_evidence_key,
    old.evidence_revision, old.locator, old.availability,
    old.extraction_method, old.observed_title, old.observed_scheduled_on,
    old.observed_held_on, old.observed_day_number, old.observed_starts_at,
    old.observed_opened_at, old.observed_closed_at, old.observed_venue,
    old.observed_status, old.created_at
  ) is distinct from row(
    new.id, new.revision_id, new.meeting_source_occurrence_id,
    new.source_version_id, new.parse_run_id, new.meeting_id,
    new.ingestion_source_id, new.role, new.source_evidence_key,
    new.evidence_revision, new.locator, new.availability,
    new.extraction_method, new.observed_title, new.observed_scheduled_on,
    new.observed_held_on, new.observed_day_number, new.observed_starts_at,
    new.observed_opened_at, new.observed_closed_at, new.observed_venue,
    new.observed_status, new.created_at
  ) then
    raise exception 'council meeting evidence content is immutable';
  end if;
  return new;
end;
$$;

create trigger council_meeting_evidence_controlled_update
before update on council_meeting_source_evidence
for each row execute function enforce_council_meeting_evidence_update();
create trigger council_meeting_evidence_no_truncate
before truncate on council_meeting_source_evidence
for each statement execute function prevent_council_meeting_identity_mutation();

create function sync_council_meeting_source_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  evidence_row public.council_meeting_source_evidence%rowtype;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.published_source_version_references
    set released_at = now()
    where consumer_type = 'common:council_meeting_revision'
      and evidence_table = 'council_meeting_source_evidence'
      and evidence_id = old.id
      and released_at is null;
  end if;

  if tg_op <> 'DELETE' then
    evidence_row := new;
    if evidence_row.extraction_method = 'parser'
      and evidence_row.qa_status = 'verified'
      and evidence_row.availability = 'available'
      and exists (
        select 1
        from public.council_meeting_revisions revision
        where revision.id = evidence_row.revision_id
          and revision.qa_status = 'verified'
          and revision.publication_state = 'published'
      ) then
      insert into public.published_source_version_references (
        consumer_type, consumer_id, evidence_table, evidence_id,
        source_version_id
      ) values (
        'common:council_meeting_revision', evidence_row.revision_id,
        'council_meeting_source_evidence', evidence_row.id,
        evidence_row.source_version_id
      );
    end if;
  end if;
  return null;
end;
$$;

create trigger council_meeting_evidence_sync_reference
after insert or update or delete on council_meeting_source_evidence
for each row execute function sync_council_meeting_source_reference();

create function sync_council_meeting_revision_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.published_source_version_references
  set released_at = now()
  where consumer_type = 'common:council_meeting_revision'
    and consumer_id = new.id
    and released_at is null;

  if new.qa_status = 'verified' and new.publication_state = 'published' then
    insert into public.published_source_version_references (
      consumer_type, consumer_id, evidence_table, evidence_id,
      source_version_id
    )
    select
      'common:council_meeting_revision', new.id,
      'council_meeting_source_evidence', evidence.id,
      evidence.source_version_id
    from public.council_meeting_source_evidence evidence
    where evidence.revision_id = new.id
      and evidence.extraction_method = 'parser'
      and evidence.qa_status = 'verified'
      and evidence.availability = 'available';
  end if;
  return null;
end;
$$;

create trigger council_meeting_revision_sync_references
after update of qa_status, publication_state on council_meeting_revisions
for each row execute function sync_council_meeting_revision_references();

create function council_meeting_publication_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_revision public.council_meeting_revisions%rowtype;
  target_revision_id uuid;
  expected_parser_count bigint;
  active_reference_count bigint;
  committee_kind public.committee_kind_enum;
  session_start date;
  session_end date;
begin
  if tg_table_name = 'council_meeting_revisions' then
    target_revision_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    target_revision_id := case when tg_op = 'DELETE'
      then old.revision_id else new.revision_id end;
  end if;

  select * into target_revision
  from public.council_meeting_revisions
  where id = target_revision_id;
  if not found or target_revision.publication_state <> 'published' then
    return null;
  end if;

  if target_revision.qa_status <> 'verified'
    or target_revision.reviewed_by is null
    or target_revision.reviewed_at is null then
    raise exception 'published council meeting revision must be reviewed';
  end if;

  if target_revision.committee_id is not null then
    select kind into committee_kind
    from public.committees where id = target_revision.committee_id;
    if (target_revision.kind = 'steering' and committee_kind <> 'steering')
      or (target_revision.kind = 'committee'
        and committee_kind not in ('standing', 'special')) then
      raise exception 'council meeting kind does not match committee kind';
    end if;
  end if;

  if target_revision.council_session_id is not null then
    select start_date, end_date into session_start, session_end
    from public.council_sessions where id = target_revision.council_session_id;
    if coalesce(target_revision.held_on, target_revision.scheduled_on)
      not between session_start and session_end then
      raise exception 'council meeting date is outside its session';
    end if;
  end if;

  if not exists (
    select 1 from public.council_meeting_source_evidence evidence
    where evidence.revision_id = target_revision.id
      and evidence.qa_status = 'verified'
      and evidence.availability = 'available'
  ) then
    raise exception 'published council meeting revision requires verified evidence';
  end if;

  if not exists (
    select 1 from public.council_meeting_source_evidence evidence
    where evidence.revision_id = target_revision.id
      and evidence.qa_status = 'verified'
      and evidence.availability = 'available'
      and evidence.observed_status = target_revision.status
      and (target_revision.scheduled_on is null
        or evidence.observed_scheduled_on = target_revision.scheduled_on)
      and (target_revision.held_on is null
        or evidence.observed_held_on = target_revision.held_on)
      and (target_revision.scheduled_starts_at is null
        or evidence.observed_starts_at = target_revision.scheduled_starts_at)
      and (target_revision.opened_at is null
        or evidence.observed_opened_at = target_revision.opened_at)
      and (target_revision.closed_at is null
        or evidence.observed_closed_at = target_revision.closed_at)
  ) then
    raise exception 'verified evidence does not support published meeting values';
  end if;

  select count(*) into expected_parser_count
  from public.council_meeting_source_evidence evidence
  where evidence.revision_id = target_revision.id
    and evidence.extraction_method = 'parser'
    and evidence.qa_status = 'verified'
    and evidence.availability = 'available';

  select count(*) into active_reference_count
  from public.published_source_version_references reference
  where reference.consumer_type = 'common:council_meeting_revision'
    and reference.consumer_id = target_revision.id
    and reference.evidence_table = 'council_meeting_source_evidence'
    and reference.released_at is null;

  if expected_parser_count <> active_reference_count
    or exists (
      select 1
      from public.published_source_version_references reference
      left join public.council_meeting_source_evidence evidence
        on evidence.id = reference.evidence_id
        and evidence.revision_id = target_revision.id
        and evidence.source_version_id = reference.source_version_id
        and evidence.extraction_method = 'parser'
        and evidence.qa_status = 'verified'
        and evidence.availability = 'available'
      where reference.consumer_type = 'common:council_meeting_revision'
        and reference.consumer_id = target_revision.id
        and reference.released_at is null
        and evidence.id is null
    ) then
    raise exception 'council meeting parser evidence registry is not synchronized';
  end if;
  return null;
end;
$$;

create constraint trigger council_meeting_revision_publication_is_valid
after insert or update or delete on council_meeting_revisions
deferrable initially deferred
for each row execute function council_meeting_publication_guard();

create constraint trigger council_meeting_evidence_publication_is_valid
after insert or update or delete on council_meeting_source_evidence
deferrable initially deferred
for each row execute function council_meeting_publication_guard();

alter table council_meetings enable row level security;
alter table council_meeting_revisions enable row level security;
alter table council_meeting_source_occurrences enable row level security;
alter table council_meeting_source_evidence enable row level security;

revoke update, delete, truncate on council_meetings,
  council_meeting_source_occurrences from anon, authenticated, service_role;
revoke delete, truncate on council_meeting_revisions,
  council_meeting_source_evidence from anon, authenticated, service_role;

revoke all on function prevent_council_meeting_identity_mutation(),
  enforce_council_meeting_revision_update(),
  enforce_council_meeting_evidence_update(),
  sync_council_meeting_source_reference(),
  sync_council_meeting_revision_references(),
  council_meeting_publication_guard()
  from public, anon, authenticated, service_role;
