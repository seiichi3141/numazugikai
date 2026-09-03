-- Versioned policy taxonomy and reproducible classification releases.

create type topic_classification_method_enum as enum ('ai', 'rule', 'manual');
create type topic_classification_status_enum as enum (
  'running', 'completed', 'failed', 'rejected'
);
create type classification_scope_kind_enum as enum (
  'council_session', 'date_range', 'fiscal_year'
);
create type classification_coverage_disposition_enum as enum (
  'classified', 'not_applicable', 'excluded'
);

create table policy_taxonomies (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (nullif(btrim(version), '') is not null),
  label text not null check (nullif(btrim(label), '') is not null),
  content_hash text,
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (qa_status <> 'verified' and publication_state = 'draft')
    or (qa_status = 'verified' and reviewed_by is not null)
  ),
  check (
    publication_state <> 'published'
    or (content_hash is not null and published_at is not null)
  )
);

create table policy_topics (
  id uuid primary key default gen_random_uuid(),
  taxonomy_id uuid not null references policy_taxonomies(id) on delete restrict,
  slug text not null check (nullif(btrim(slug), '') is not null),
  label text not null check (nullif(btrim(label), '') is not null),
  description text not null default '',
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (taxonomy_id, slug),
  unique (id, taxonomy_id)
);

create table topic_classification_runs (
  id uuid primary key default gen_random_uuid(),
  taxonomy_id uuid not null references policy_taxonomies(id) on delete restrict,
  method topic_classification_method_enum not null,
  model_name text,
  prompt_version text,
  status topic_classification_status_enum not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'running' and finished_at is null)
    or (status <> 'running' and finished_at is not null)
  ),
  unique (id, taxonomy_id)
);

create table general_question_item_classification_sets (
  id uuid primary key default gen_random_uuid(),
  question_item_revision_id uuid not null
    references general_question_item_revisions(id) on delete restrict,
  classification_run_id uuid not null,
  taxonomy_id uuid not null,
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (classification_run_id, taxonomy_id)
    references topic_classification_runs(id, taxonomy_id) on delete restrict,
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (qa_status <> 'verified' and publication_state = 'draft')
    or (qa_status = 'verified' and reviewed_by is not null)
  ),
  unique (question_item_revision_id, classification_run_id),
  unique (id, taxonomy_id)
);

create unique index general_question_item_classification_one_published
  on general_question_item_classification_sets (
    question_item_revision_id, taxonomy_id
  ) where publication_state = 'published';

create table general_question_item_topics (
  classification_set_id uuid not null,
  taxonomy_id uuid not null,
  policy_topic_id uuid not null,
  confidence numeric(5, 4) check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  ),
  created_at timestamptz not null default now(),
  primary key (classification_set_id, policy_topic_id),
  foreign key (classification_set_id, taxonomy_id)
    references general_question_item_classification_sets(id, taxonomy_id)
    on delete restrict,
  foreign key (policy_topic_id, taxonomy_id)
    references policy_topics(id, taxonomy_id) on delete restrict
);

create table topic_classification_population_snapshots (
  id uuid primary key default gen_random_uuid(),
  consumer_type text not null,
  snapshot_key text not null,
  scope_kind classification_scope_kind_enum not null,
  council_session_id uuid references council_sessions(id) on delete restrict,
  period_start date,
  period_end date,
  fiscal_year integer,
  selection_rule_version text not null,
  cutoff_at timestamptz not null,
  subject_count integer not null check (subject_count >= 0),
  ordered_subject_ids_hash text not null,
  created_at timestamptz not null default now(),
  check (nullif(btrim(consumer_type), '') is not null),
  check (nullif(btrim(snapshot_key), '') is not null),
  check (nullif(btrim(selection_rule_version), '') is not null),
  check (
    (scope_kind = 'council_session' and council_session_id is not null
      and period_start is null and period_end is null and fiscal_year is null)
    or (scope_kind = 'date_range' and council_session_id is null
      and period_start is not null and period_end is not null
      and period_end >= period_start and fiscal_year is null)
    or (scope_kind = 'fiscal_year' and council_session_id is null
      and period_start is null and period_end is null and fiscal_year is not null)
  ),
  unique (consumer_type, snapshot_key),
  unique (id, consumer_type)
);

create table general_question_classification_population_members (
  snapshot_id uuid not null references topic_classification_population_snapshots(id)
    on delete restrict,
  question_item_revision_id uuid not null
    references general_question_item_revisions(id) on delete restrict,
  ordinal integer not null check (ordinal >= 1),
  primary key (snapshot_id, question_item_revision_id),
  unique (snapshot_id, ordinal)
);

create table topic_classification_releases (
  id uuid primary key default gen_random_uuid(),
  consumer_type text not null,
  release_key text not null,
  taxonomy_id uuid not null references policy_taxonomies(id) on delete restrict,
  population_snapshot_id uuid not null
    references topic_classification_population_snapshots(id) on delete restrict,
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (qa_status <> 'verified' and publication_state = 'draft')
    or (qa_status = 'verified' and reviewed_by is not null)
  ),
  check (
    publication_state <> 'published' or published_at is not null
  ),
  unique (consumer_type, release_key)
);

create unique index topic_classification_releases_one_active
  on topic_classification_releases (consumer_type)
  where publication_state = 'published';

create table general_question_classification_release_items (
  release_id uuid not null references topic_classification_releases(id)
    on delete restrict,
  population_snapshot_id uuid not null,
  taxonomy_id uuid not null,
  question_item_revision_id uuid not null,
  classification_set_id uuid,
  coverage_disposition classification_coverage_disposition_enum not null,
  exclusion_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (release_id, question_item_revision_id),
  foreign key (population_snapshot_id, question_item_revision_id)
    references general_question_classification_population_members(
      snapshot_id, question_item_revision_id
    ) on delete restrict,
  foreign key (classification_set_id, taxonomy_id)
    references general_question_item_classification_sets(id, taxonomy_id)
    on delete restrict,
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (coverage_disposition = 'classified' and classification_set_id is not null
      and exclusion_reason is null)
    or (coverage_disposition in ('not_applicable', 'excluded')
      and classification_set_id is null
      and nullif(btrim(exclusion_reason), '') is not null
      and reviewed_by is not null)
  )
);

create function create_topic_classification_population_snapshot(
  p_consumer_type text,
  p_snapshot_key text,
  p_scope_kind classification_scope_kind_enum,
  p_selection_rule_version text,
  p_council_session_id uuid default null,
  p_period_start date default null,
  p_period_end date default null,
  p_fiscal_year integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_id uuid := gen_random_uuid();
  item_ids uuid[];
begin
  select coalesce(array_agg(item.id order by meeting.held_on,
    appearance.question_order, item.item_order, item.id), array[]::uuid[])
  into item_ids
  from public.general_question_item_revisions item
  join public.general_question_appearance_revisions appearance
    on appearance.appearance_id = item.appearance_id
    and appearance.publication_state = 'published'
    and appearance.qa_status = 'verified'
  join public.council_meeting_revisions meeting
    on meeting.meeting_id = appearance.meeting_id
    and meeting.publication_state = 'published'
    and meeting.qa_status = 'verified'
    and meeting.status = 'held'
    and meeting.held_on is not null
  where item.publication_state = 'published'
    and item.qa_status = 'verified'
    and (
      (p_scope_kind = 'council_session'
        and meeting.council_session_id = p_council_session_id)
      or (p_scope_kind = 'date_range'
        and meeting.held_on between p_period_start and p_period_end)
      or (p_scope_kind = 'fiscal_year'
        and meeting.held_on >= make_date(p_fiscal_year, 4, 1)
        and meeting.held_on < make_date(p_fiscal_year + 1, 4, 1))
    );

  insert into public.topic_classification_population_snapshots (
    id, consumer_type, snapshot_key, scope_kind, council_session_id,
    period_start, period_end, fiscal_year, selection_rule_version,
    cutoff_at, subject_count, ordered_subject_ids_hash
  ) values (
    snapshot_id, p_consumer_type, p_snapshot_key, p_scope_kind,
    p_council_session_id, p_period_start, p_period_end, p_fiscal_year,
    p_selection_rule_version, transaction_timestamp(),
    cardinality(item_ids), md5(array_to_string(item_ids, ','))
  );
  insert into public.general_question_classification_population_members (
    snapshot_id, question_item_revision_id, ordinal
  ) select snapshot_id, item_id, ordinal::integer
    from unnest(item_ids) with ordinality as member(item_id, ordinal);
  return snapshot_id;
end;
$$;

alter table policy_taxonomies enable row level security;
alter table policy_topics enable row level security;
alter table topic_classification_runs enable row level security;
alter table general_question_item_classification_sets enable row level security;
alter table general_question_item_topics enable row level security;
alter table topic_classification_population_snapshots enable row level security;
alter table general_question_classification_population_members enable row level security;
alter table topic_classification_releases enable row level security;
alter table general_question_classification_release_items enable row level security;

revoke insert, update, delete, truncate on
  topic_classification_population_snapshots,
  general_question_classification_population_members
  from anon, authenticated, service_role;
revoke all on function create_topic_classification_population_snapshot(
  text, text, classification_scope_kind_enum, text, uuid, date, date, integer
) from public, anon, authenticated;
grant execute on function create_topic_classification_population_snapshot(
  text, text, classification_scope_kind_enum, text, uuid, date, date, integer
) to service_role;
