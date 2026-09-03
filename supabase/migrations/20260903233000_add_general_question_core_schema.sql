-- General-question stable identities, revisions, evidence and coverage (Phase 0).

create type general_question_kind_enum as enum (
  'representative', 'personal', 'other', 'unknown'
);
create type general_question_delivery_method_enum as enum (
  'all_at_once', 'one_by_one', 'combined', 'other', 'unknown'
);
create type general_question_role_group_enum as enum (
  'mayor', 'deputy_mayor', 'superintendent', 'department_head',
  'division_head', 'administration_other', 'unknown'
);
create type general_question_session_disposition_enum as enum (
  'held', 'not_held', 'not_applicable', 'unknown'
);
create type general_question_evidence_role_enum as enum (
  'primary', 'supplementary'
);

create table general_question_appearances (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references council_meetings(id) on delete restrict,
  appearance_key text not null check (nullif(btrim(appearance_key), '') is not null),
  created_at timestamptz not null default now(),
  unique (meeting_id, appearance_key),
  unique (id, meeting_id)
);

create table general_question_appearance_revisions (
  id uuid primary key default gen_random_uuid(),
  appearance_id uuid not null,
  meeting_id uuid not null,
  revision_number integer not null check (revision_number >= 1),
  council_member_id uuid references council_members(id) on delete restrict,
  speaker_display_name text not null
    check (nullif(btrim(speaker_display_name), '') is not null),
  seat_number integer check (seat_number is null or seat_number >= 1),
  question_order integer check (question_order is null or question_order >= 1),
  question_kind general_question_kind_enum not null default 'unknown',
  delivery_method general_question_delivery_method_enum not null default 'unknown',
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (appearance_id, meeting_id)
    references general_question_appearances(id, meeting_id) on delete restrict,
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (qa_status <> 'verified' and publication_state = 'draft')
    or (qa_status = 'verified' and reviewed_by is not null)
  ),
  check (
    (publication_state in ('published', 'superseded') and published_at is not null)
    or (publication_state in ('draft', 'reviewed') and published_at is null)
  ),
  unique (appearance_id, revision_number),
  unique (id, appearance_id, meeting_id)
);

create unique index general_question_appearance_one_published
  on general_question_appearance_revisions (appearance_id)
  where publication_state = 'published';
create unique index general_question_appearance_published_order
  on general_question_appearance_revisions (meeting_id, question_order)
  where publication_state = 'published' and question_order is not null;

create table general_question_appearance_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  appearance_id uuid not null,
  meeting_id uuid not null,
  meeting_source_occurrence_id uuid not null,
  ingestion_source_id uuid not null,
  source_appearance_key text not null
    check (nullif(btrim(source_appearance_key), '') is not null),
  created_at timestamptz not null default now(),
  foreign key (appearance_id, meeting_id)
    references general_question_appearances(id, meeting_id) on delete restrict,
  foreign key (
    meeting_source_occurrence_id, meeting_id, ingestion_source_id
  ) references council_meeting_source_occurrences(
    id, meeting_id, ingestion_source_id
  ) on delete restrict,
  unique (meeting_source_occurrence_id, source_appearance_key),
  unique (id, appearance_id),
  unique (id, appearance_id, meeting_id, ingestion_source_id)
);

create table general_question_appearance_sources (
  id uuid primary key default gen_random_uuid(),
  appearance_source_occurrence_id uuid not null,
  appearance_revision_id uuid not null,
  appearance_id uuid not null,
  meeting_id uuid not null,
  ingestion_source_id uuid not null,
  source_version_id uuid not null,
  parse_run_id uuid,
  source_locator text,
  role general_question_evidence_role_enum not null default 'primary',
  extraction_method extraction_method_enum not null,
  observed_speaker_name text,
  observed_seat_number integer check (
    observed_seat_number is null or observed_seat_number >= 1
  ),
  observed_question_order integer check (
    observed_question_order is null or observed_question_order >= 1
  ),
  observed_question_kind general_question_kind_enum,
  observed_delivery_method general_question_delivery_method_enum,
  evidence_revision integer not null default 1 check (evidence_revision >= 1),
  qa_status qa_status_enum not null default 'pending',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (appearance_revision_id, appearance_id, meeting_id)
    references general_question_appearance_revisions(
      id, appearance_id, meeting_id
    ) on delete restrict,
  foreign key (
    appearance_source_occurrence_id, appearance_id, meeting_id,
    ingestion_source_id
  ) references general_question_appearance_source_occurrences(
    id, appearance_id, meeting_id, ingestion_source_id
  ) on delete restrict,
  foreign key (source_version_id, ingestion_source_id)
    references ingestion_source_versions(id, ingestion_source_id)
    on delete restrict,
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
    or (verified_by is not null and (
      extraction_method <> 'manual'
      or nullif(btrim(source_locator), '') is not null
    ))
  ),
  unique (id, appearance_source_occurrence_id, appearance_id),
  unique nulls not distinct (
    appearance_source_occurrence_id, source_version_id, parse_run_id,
    evidence_revision
  )
);

create table general_question_items (
  id uuid primary key default gen_random_uuid(),
  appearance_id uuid not null references general_question_appearances(id)
    on delete restrict,
  item_key text not null check (nullif(btrim(item_key), '') is not null),
  created_at timestamptz not null default now(),
  unique (appearance_id, item_key),
  unique (id, appearance_id)
);

create table general_question_item_revisions (
  id uuid primary key default gen_random_uuid(),
  question_item_id uuid not null,
  appearance_id uuid not null,
  revision_number integer not null check (revision_number >= 1),
  parent_item_id uuid,
  item_order integer check (item_order is null or item_order >= 1),
  public_summary text not null check (nullif(btrim(public_summary), '') is not null),
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (question_item_id, appearance_id)
    references general_question_items(id, appearance_id) on delete restrict,
  foreign key (parent_item_id, appearance_id)
    references general_question_items(id, appearance_id) on delete restrict,
  check (parent_item_id is null or parent_item_id <> question_item_id),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (qa_status <> 'verified' and publication_state = 'draft')
    or (qa_status = 'verified' and reviewed_by is not null)
  ),
  unique (question_item_id, revision_number),
  unique (id, question_item_id, appearance_id)
);

create unique index general_question_item_one_published
  on general_question_item_revisions (question_item_id)
  where publication_state = 'published';
create unique index general_question_item_published_order
  on general_question_item_revisions (
    appearance_id, parent_item_id, item_order
  ) nulls not distinct
  where publication_state = 'published' and item_order is not null;

create table general_question_item_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  question_item_id uuid not null,
  appearance_id uuid not null,
  appearance_source_occurrence_id uuid not null,
  source_item_key text not null check (nullif(btrim(source_item_key), '') is not null),
  created_at timestamptz not null default now(),
  foreign key (question_item_id, appearance_id)
    references general_question_items(id, appearance_id) on delete restrict,
  foreign key (appearance_source_occurrence_id, appearance_id)
    references general_question_appearance_source_occurrences(id, appearance_id)
    on delete restrict,
  unique (appearance_source_occurrence_id, source_item_key),
  unique (id, question_item_id, appearance_id, appearance_source_occurrence_id)
);

create table general_question_item_sources (
  id uuid primary key default gen_random_uuid(),
  item_source_occurrence_id uuid not null,
  appearance_source_occurrence_id uuid not null,
  question_item_revision_id uuid not null,
  question_item_id uuid not null,
  appearance_id uuid not null,
  appearance_source_id uuid not null,
  evidence_revision integer not null default 1 check (evidence_revision >= 1),
  source_locator text,
  observed_label text,
  official_label_hash text,
  qa_status qa_status_enum not null default 'pending',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (question_item_revision_id, question_item_id, appearance_id)
    references general_question_item_revisions(
      id, question_item_id, appearance_id
    ) on delete restrict,
  foreign key (
    item_source_occurrence_id, question_item_id, appearance_id,
    appearance_source_occurrence_id
  ) references general_question_item_source_occurrences(
    id, question_item_id, appearance_id, appearance_source_occurrence_id
  ) on delete restrict,
  foreign key (
    appearance_source_id, appearance_source_occurrence_id, appearance_id
  ) references general_question_appearance_sources(
    id, appearance_source_occurrence_id, appearance_id
  ) on delete restrict,
  check ((verified_by is null) = (verified_at is null)),
  check (qa_status <> 'verified' or verified_by is not null),
  unique (item_source_occurrence_id, appearance_source_id, evidence_revision)
);

create table general_question_answerers (
  id uuid primary key default gen_random_uuid(),
  appearance_id uuid not null references general_question_appearances(id)
    on delete restrict,
  answerer_key text not null check (nullif(btrim(answerer_key), '') is not null),
  created_at timestamptz not null default now(),
  unique (appearance_id, answerer_key),
  unique (id, appearance_id)
);

create table general_question_answerer_revisions (
  id uuid primary key default gen_random_uuid(),
  answerer_id uuid not null,
  appearance_id uuid not null,
  revision_number integer not null check (revision_number >= 1),
  council_member_id uuid references council_members(id) on delete restrict,
  person_display_name text not null
    check (nullif(btrim(person_display_name), '') is not null),
  role_display_name text not null
    check (nullif(btrim(role_display_name), '') is not null),
  role_group general_question_role_group_enum not null default 'unknown',
  department_key text,
  display_order integer check (display_order is null or display_order >= 1),
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (answerer_id, appearance_id)
    references general_question_answerers(id, appearance_id) on delete restrict,
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (qa_status <> 'verified' and publication_state = 'draft')
    or (qa_status = 'verified' and reviewed_by is not null)
  ),
  unique (answerer_id, revision_number),
  unique (id, answerer_id, appearance_id)
);

create unique index general_question_answerer_one_published
  on general_question_answerer_revisions (answerer_id)
  where publication_state = 'published';
create unique index general_question_answerer_published_order
  on general_question_answerer_revisions (appearance_id, display_order)
  where publication_state = 'published' and display_order is not null;

create table general_question_answerer_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  answerer_id uuid not null,
  appearance_id uuid not null,
  appearance_source_occurrence_id uuid not null,
  source_answerer_key text not null
    check (nullif(btrim(source_answerer_key), '') is not null),
  created_at timestamptz not null default now(),
  foreign key (answerer_id, appearance_id)
    references general_question_answerers(id, appearance_id) on delete restrict,
  foreign key (appearance_source_occurrence_id, appearance_id)
    references general_question_appearance_source_occurrences(id, appearance_id)
    on delete restrict,
  unique (appearance_source_occurrence_id, source_answerer_key),
  unique (id, answerer_id, appearance_id, appearance_source_occurrence_id)
);

create table general_question_answerer_sources (
  id uuid primary key default gen_random_uuid(),
  answerer_source_occurrence_id uuid not null,
  appearance_source_occurrence_id uuid not null,
  answerer_revision_id uuid not null,
  answerer_id uuid not null,
  appearance_id uuid not null,
  appearance_source_id uuid not null,
  evidence_revision integer not null default 1 check (evidence_revision >= 1),
  source_locator text,
  observed_person_name text,
  observed_role_name text,
  observed_department_name text,
  qa_status qa_status_enum not null default 'pending',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (answerer_revision_id, answerer_id, appearance_id)
    references general_question_answerer_revisions(
      id, answerer_id, appearance_id
    ) on delete restrict,
  foreign key (
    answerer_source_occurrence_id, answerer_id, appearance_id,
    appearance_source_occurrence_id
  ) references general_question_answerer_source_occurrences(
    id, answerer_id, appearance_id, appearance_source_occurrence_id
  ) on delete restrict,
  foreign key (
    appearance_source_id, appearance_source_occurrence_id, appearance_id
  ) references general_question_appearance_sources(
    id, appearance_source_occurrence_id, appearance_id
  ) on delete restrict,
  check ((verified_by is null) = (verified_at is null)),
  check (qa_status <> 'verified' or verified_by is not null),
  unique (answerer_source_occurrence_id, appearance_source_id, evidence_revision)
);

create table general_question_session_coverage (
  id uuid primary key default gen_random_uuid(),
  council_session_id uuid not null references council_sessions(id) on delete restrict,
  source_kind text not null check (nullif(btrim(source_kind), '') is not null),
  created_at timestamptz not null default now(),
  unique (council_session_id, source_kind),
  unique (id, council_session_id, source_kind)
);

create table general_question_session_coverage_observations (
  id uuid primary key default gen_random_uuid(),
  coverage_id uuid not null,
  council_session_id uuid not null,
  source_kind text not null,
  observation_key text not null check (nullif(btrim(observation_key), '') is not null),
  state coverage_state_enum not null,
  record_presence record_presence_enum not null,
  session_disposition general_question_session_disposition_enum not null,
  expected_count integer check (expected_count is null or expected_count >= 0),
  matched_count integer check (matched_count is null or matched_count >= 0),
  checked_at timestamptz not null,
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (coverage_id, council_session_id, source_kind)
    references general_question_session_coverage(
      id, council_session_id, source_kind
    ) on delete restrict,
  check (
    expected_count is null or matched_count is null
    or matched_count <= expected_count
  ),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (qa_status <> 'verified' and publication_state = 'draft')
    or (qa_status = 'verified' and reviewed_by is not null)
  ),
  check (
    (session_disposition = 'held'
      and state in ('collected', 'partial')
      and record_presence = 'present'
      and matched_count >= 1)
    or (session_disposition = 'not_held'
      and state = 'collected'
      and record_presence = 'absent'
      and expected_count = 0 and matched_count = 0)
    or (session_disposition = 'not_applicable'
      and state = 'not_applicable'
      and record_presence = 'unknown'
      and expected_count is null and matched_count is null)
    or (session_disposition = 'unknown'
      and state = 'collected'
      and record_presence = 'absent'
      and matched_count = 0)
    or (session_disposition = 'unknown'
      and state = 'partial'
      and record_presence = 'unknown'
      and coalesce(matched_count, 0) = 0)
    or (session_disposition = 'unknown'
      and state in (
        'uncollected', 'source_not_published', 'source_unavailable', 'error'
      )
      and record_presence = 'unknown'
      and expected_count is null and matched_count is null)
  ),
  unique (coverage_id, observation_key),
  unique (id, coverage_id, council_session_id, source_kind)
);

create unique index general_question_coverage_one_published
  on general_question_session_coverage_observations (coverage_id)
  where publication_state = 'published';

create table general_question_session_coverage_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  coverage_id uuid not null,
  council_session_id uuid not null,
  source_kind text not null,
  ingestion_source_id uuid not null references ingestion_sources(id)
    on delete restrict,
  source_coverage_key text not null
    check (nullif(btrim(source_coverage_key), '') is not null),
  created_at timestamptz not null default now(),
  foreign key (coverage_id, council_session_id, source_kind)
    references general_question_session_coverage(
      id, council_session_id, source_kind
    ) on delete restrict,
  unique (ingestion_source_id, source_coverage_key),
  unique (
    id, coverage_id, council_session_id, source_kind, ingestion_source_id
  )
);

create table general_question_session_coverage_observation_sources (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null,
  coverage_id uuid not null,
  council_session_id uuid not null,
  source_kind text not null,
  coverage_source_occurrence_id uuid not null,
  ingestion_source_id uuid not null,
  source_version_id uuid not null,
  parse_run_id uuid,
  evidence_revision integer not null default 1 check (evidence_revision >= 1),
  evidence_role general_question_evidence_role_enum not null default 'primary',
  source_locator text,
  extraction_method extraction_method_enum not null,
  qa_status qa_status_enum not null default 'pending',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (observation_id, coverage_id, council_session_id, source_kind)
    references general_question_session_coverage_observations(
      id, coverage_id, council_session_id, source_kind
    ) on delete restrict,
  foreign key (
    coverage_source_occurrence_id, coverage_id, council_session_id,
    source_kind, ingestion_source_id
  ) references general_question_session_coverage_source_occurrences(
    id, coverage_id, council_session_id, source_kind, ingestion_source_id
  ) on delete restrict,
  foreign key (source_version_id, ingestion_source_id)
    references ingestion_source_versions(id, ingestion_source_id)
    on delete restrict,
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
    or (verified_by is not null and (
      extraction_method <> 'manual'
      or nullif(btrim(source_locator), '') is not null
    ))
  ),
  unique nulls not distinct (
    coverage_source_occurrence_id, source_version_id, parse_run_id,
    evidence_revision
  )
);

insert into source_artifact_consumer_types (
  consumer_type, description, registered_by_migration
) values
  (
    'general_question:appearance_revision',
    '公開中の一般質問登壇revisionを支えるparser根拠',
    '20260903233000_add_general_question_core_schema.sql'
  ),
  (
    'general_question:item_revision',
    '公開中の一般質問項目revisionを支えるparser根拠',
    '20260903233000_add_general_question_core_schema.sql'
  ),
  (
    'general_question:answerer_revision',
    '公開中の一般質問答弁者revisionを支えるparser根拠',
    '20260903233000_add_general_question_core_schema.sql'
  ),
  (
    'general_question:session_coverage_observation',
    '公開中の一般質問会期カバレッジを支えるparser根拠',
    '20260903233000_add_general_question_core_schema.sql'
  );

alter table general_question_appearances enable row level security;
alter table general_question_appearance_revisions enable row level security;
alter table general_question_appearance_source_occurrences enable row level security;
alter table general_question_appearance_sources enable row level security;
alter table general_question_items enable row level security;
alter table general_question_item_revisions enable row level security;
alter table general_question_item_source_occurrences enable row level security;
alter table general_question_item_sources enable row level security;
alter table general_question_answerers enable row level security;
alter table general_question_answerer_revisions enable row level security;
alter table general_question_answerer_source_occurrences enable row level security;
alter table general_question_answerer_sources enable row level security;
alter table general_question_session_coverage enable row level security;
alter table general_question_session_coverage_observations enable row level security;
alter table general_question_session_coverage_source_occurrences
  enable row level security;
alter table general_question_session_coverage_observation_sources
  enable row level security;
