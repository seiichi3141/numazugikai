-- Complete the fiscal audit identities that must exist before ingestion/UI work.
-- Publication remains fail-closed until the cross-table publication workflow lands.

create type fiscal_data_kind_enum as enum (
  'document_edition', 'scope_membership', 'amount_set',
  'classification', 'classification_mapping', 'indicator', 'bill_link'
);
create type fiscal_classification_relation_kind_enum as enum (
  'rename', 'split', 'merge', 'equivalent'
);
create type fiscal_classification_direction_enum as enum ('from', 'to');

alter table fiscal_event_bill_link_revisions
  add constraint fiscal_event_bill_link_revision_identity_unique
  unique (id, link_id, fiscal_event_id);

create table fiscal_data_coverage (
  id uuid primary key default gen_random_uuid(),
  fiscal_year smallint not null,
  reporting_scope_id uuid not null
    references fiscal_reporting_scopes(id) on delete restrict,
  account_id uuid references fiscal_accounts(id) on delete restrict,
  account_identity_key text generated always as (
    coalesce(account_id::text, 'scope-only')
  ) stored,
  source_kind fiscal_source_kind_enum not null,
  data_kind fiscal_data_kind_enum not null,
  as_of_date date,
  as_of_identity_key text generated always as (
    coalesce('date-day:' || (as_of_date - date '0001-01-01')::text,
      'not-applicable')
  ) stored,
  created_at timestamptz not null default now(),
  unique nulls not distinct (
    fiscal_year, reporting_scope_id, account_id, source_kind,
    data_kind, as_of_date
  ),
  unique (
    id, fiscal_year, reporting_scope_id, account_identity_key,
    source_kind, data_kind, as_of_identity_key
  )
);

create table fiscal_data_coverage_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  coverage_id uuid not null,
  fiscal_year smallint not null,
  reporting_scope_id uuid not null,
  account_id uuid references fiscal_accounts(id) on delete restrict,
  account_identity_key text generated always as (
    coalesce(account_id::text, 'scope-only')
  ) stored,
  source_kind fiscal_source_kind_enum not null,
  data_kind fiscal_data_kind_enum not null,
  as_of_date date,
  as_of_identity_key text generated always as (
    coalesce('date-day:' || (as_of_date - date '0001-01-01')::text,
      'not-applicable')
  ) stored,
  edition_source_occurrence_id uuid not null,
  edition_id uuid not null,
  ingestion_source_id uuid not null,
  source_coverage_key text not null
    check (nullif(btrim(source_coverage_key), '') is not null),
  created_at timestamptz not null default now(),
  foreign key (
    coverage_id, fiscal_year, reporting_scope_id, account_identity_key,
    source_kind, data_kind, as_of_identity_key
  ) references fiscal_data_coverage(
    id, fiscal_year, reporting_scope_id, account_identity_key,
    source_kind, data_kind, as_of_identity_key
  ) on delete restrict,
  foreign key (edition_source_occurrence_id, edition_id, ingestion_source_id)
    references fiscal_source_document_edition_source_occurrences(
      id, edition_id, ingestion_source_id
    ) on delete restrict,
  unique (edition_source_occurrence_id, source_coverage_key),
  unique (
    id, coverage_id, fiscal_year, reporting_scope_id,
    account_identity_key, source_kind, data_kind, as_of_identity_key,
    edition_source_occurrence_id, edition_id, ingestion_source_id
  )
);

create table fiscal_data_coverage_observations (
  id uuid primary key default gen_random_uuid(),
  coverage_id uuid not null,
  fiscal_year smallint not null,
  reporting_scope_id uuid not null,
  account_id uuid references fiscal_accounts(id) on delete restrict,
  account_identity_key text generated always as (
    coalesce(account_id::text, 'scope-only')
  ) stored,
  source_kind fiscal_source_kind_enum not null,
  data_kind fiscal_data_kind_enum not null,
  as_of_date date,
  as_of_identity_key text generated always as (
    coalesce('date-day:' || (as_of_date - date '0001-01-01')::text,
      'not-applicable')
  ) stored,
  observation_key text not null
    check (nullif(btrim(observation_key), '') is not null),
  state coverage_state_enum not null,
  record_presence record_presence_enum not null,
  expected_count integer check (expected_count is null or expected_count >= 0),
  matched_count integer check (matched_count is null or matched_count >= 0),
  reason_code text,
  details jsonb,
  observed_at timestamptz not null default now(),
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (
    coverage_id, fiscal_year, reporting_scope_id, account_identity_key,
    source_kind, data_kind, as_of_identity_key
  ) references fiscal_data_coverage(
    id, fiscal_year, reporting_scope_id, account_identity_key,
    source_kind, data_kind, as_of_identity_key
  ) on delete restrict,
  check (
    expected_count is null or matched_count is null
    or matched_count <= expected_count
  ),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (publication_state = 'draft' and qa_status in ('pending', 'rejected'))
    or (publication_state in ('reviewed', 'published', 'superseded')
      and qa_status = 'verified' and reviewed_by is not null)
  ),
  check (
    (state = 'collected' and record_presence = 'present'
      and matched_count is not null and matched_count >= 1)
    or (state = 'collected' and record_presence = 'absent'
      and expected_count = 0 and matched_count = 0)
    or (state = 'partial' and record_presence = 'present'
      and matched_count is not null and matched_count >= 1
      and (expected_count is null or matched_count < expected_count))
    or (state = 'partial' and record_presence = 'unknown'
      and coalesce(matched_count, 0) = 0)
    or (state = 'not_applicable' and record_presence = 'unknown'
      and expected_count is null and matched_count is null)
    or (state in (
        'uncollected', 'source_not_published', 'source_unavailable', 'error'
      ) and record_presence = 'unknown'
      and expected_count is null and matched_count is null)
  ),
  unique (coverage_id, observation_key),
  unique (
    id, coverage_id, fiscal_year, reporting_scope_id,
    account_identity_key, source_kind, data_kind, as_of_identity_key
  )
);

create unique index fiscal_data_coverage_one_published
  on fiscal_data_coverage_observations (coverage_id)
  where publication_state = 'published';

create table fiscal_data_coverage_observation_sources (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null,
  coverage_id uuid not null,
  fiscal_year smallint not null,
  reporting_scope_id uuid not null,
  account_id uuid references fiscal_accounts(id) on delete restrict,
  account_identity_key text generated always as (
    coalesce(account_id::text, 'scope-only')
  ) stored,
  source_kind fiscal_source_kind_enum not null,
  data_kind fiscal_data_kind_enum not null,
  as_of_date date,
  as_of_identity_key text generated always as (
    coalesce('date-day:' || (as_of_date - date '0001-01-01')::text,
      'not-applicable')
  ) stored,
  coverage_source_occurrence_id uuid not null,
  edition_source_occurrence_id uuid not null,
  edition_observation_id uuid not null,
  edition_id uuid not null,
  ingestion_source_id uuid not null,
  source_version_id uuid not null,
  parse_run_id uuid,
  parse_run_identity_key text generated always as (
    coalesce(parse_run_id::text, 'manual')
  ) stored,
  evidence_revision integer not null default 1 check (evidence_revision >= 1),
  evidence_role fiscal_evidence_role_enum not null,
  observed_presence record_presence_enum not null,
  source_locator text,
  extraction_method extraction_method_enum not null,
  qa_status qa_status_enum not null default 'pending',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (
    observation_id, coverage_id, fiscal_year, reporting_scope_id,
    account_identity_key, source_kind, data_kind, as_of_identity_key
  ) references fiscal_data_coverage_observations(
    id, coverage_id, fiscal_year, reporting_scope_id,
    account_identity_key, source_kind, data_kind, as_of_identity_key
  ) on delete restrict,
  foreign key (
    coverage_source_occurrence_id, coverage_id, fiscal_year,
    reporting_scope_id, account_identity_key, source_kind, data_kind,
    as_of_identity_key, edition_source_occurrence_id, edition_id,
    ingestion_source_id
  ) references fiscal_data_coverage_source_occurrences(
    id, coverage_id, fiscal_year, reporting_scope_id,
    account_identity_key, source_kind, data_kind, as_of_identity_key,
    edition_source_occurrence_id, edition_id, ingestion_source_id
  ) on delete restrict,
  foreign key (
    edition_observation_id, edition_source_occurrence_id, edition_id,
    ingestion_source_id, source_version_id, parse_run_identity_key
  ) references fiscal_source_document_edition_observations(
    id, edition_source_occurrence_id, edition_id, ingestion_source_id,
    source_version_id, parse_run_identity_key
  ) on delete restrict,
  foreign key (parse_run_id, source_version_id)
    references ingestion_parse_runs(id, source_version_id) on delete restrict,
  check (
    (extraction_method = 'parser' and parse_run_id is not null
      and evidence_revision = 1)
    or (extraction_method = 'manual' and parse_run_id is null
      and nullif(btrim(source_locator), '') is not null)
  ),
  check (evidence_role in ('primary', 'corroborating')),
  check ((verified_by is null) = (verified_at is null)),
  check (qa_status <> 'verified' or verified_by is not null),
  unique nulls not distinct (
    coverage_source_occurrence_id, source_version_id, parse_run_id,
    evidence_revision
  )
);

create table fiscal_classification_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  classification_id uuid not null,
  scheme text not null,
  edition_source_occurrence_id uuid not null,
  edition_id uuid not null,
  ingestion_source_id uuid not null,
  source_classification_key text not null
    check (nullif(btrim(source_classification_key), '') is not null),
  created_at timestamptz not null default now(),
  foreign key (classification_id, scheme)
    references fiscal_classifications(id, scheme) on delete restrict,
  foreign key (edition_source_occurrence_id, edition_id, ingestion_source_id)
    references fiscal_source_document_edition_source_occurrences(
      id, edition_id, ingestion_source_id
    ) on delete restrict,
  unique (
    edition_source_occurrence_id, scheme, source_classification_key
  ),
  unique (
    id, classification_id, scheme, edition_source_occurrence_id,
    edition_id, ingestion_source_id
  )
);

create table fiscal_classification_sources (
  id uuid primary key default gen_random_uuid(),
  classification_revision_id uuid not null,
  classification_id uuid not null,
  scheme text not null,
  classification_source_occurrence_id uuid not null,
  edition_source_occurrence_id uuid not null,
  edition_observation_id uuid not null,
  edition_id uuid not null,
  ingestion_source_id uuid not null,
  source_version_id uuid not null,
  parse_run_id uuid,
  parse_run_identity_key text generated always as (
    coalesce(parse_run_id::text, 'manual')
  ) stored,
  evidence_revision integer not null default 1 check (evidence_revision >= 1),
  source_code text,
  source_label text not null check (nullif(btrim(source_label), '') is not null),
  source_department_name text,
  observed_fiscal_year smallint not null,
  source_locator text,
  extraction_method extraction_method_enum not null,
  qa_status qa_status_enum not null default 'pending',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (classification_revision_id, classification_id, scheme)
    references fiscal_classification_revisions(
      id, classification_id, scheme
    ) on delete restrict,
  foreign key (
    classification_source_occurrence_id, classification_id, scheme,
    edition_source_occurrence_id, edition_id, ingestion_source_id
  ) references fiscal_classification_source_occurrences(
    id, classification_id, scheme, edition_source_occurrence_id,
    edition_id, ingestion_source_id
  ) on delete restrict,
  foreign key (
    edition_observation_id, edition_source_occurrence_id, edition_id,
    ingestion_source_id, source_version_id, parse_run_identity_key
  ) references fiscal_source_document_edition_observations(
    id, edition_source_occurrence_id, edition_id, ingestion_source_id,
    source_version_id, parse_run_identity_key
  ) on delete restrict,
  foreign key (parse_run_id, source_version_id)
    references ingestion_parse_runs(id, source_version_id) on delete restrict,
  check (
    (extraction_method = 'parser' and parse_run_id is not null
      and evidence_revision = 1)
    or (extraction_method = 'manual' and parse_run_id is null
      and nullif(btrim(source_locator), '') is not null)
  ),
  check ((verified_by is null) = (verified_at is null)),
  check (qa_status <> 'verified' or verified_by is not null),
  unique nulls not distinct (
    classification_source_occurrence_id, source_version_id, parse_run_id,
    evidence_revision
  )
);

create table fiscal_classification_mappings (
  id uuid primary key default gen_random_uuid(),
  scheme text not null,
  mapping_key text not null check (nullif(btrim(mapping_key), '') is not null),
  created_at timestamptz not null default now(),
  unique (scheme, mapping_key),
  unique (id, scheme)
);

create table fiscal_classification_mapping_revisions (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid not null,
  scheme text not null,
  revision_number integer not null check (revision_number >= 1),
  relation_kind fiscal_classification_relation_kind_enum not null,
  effective_fiscal_year smallint not null,
  note text,
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (mapping_id, scheme)
    references fiscal_classification_mappings(id, scheme) on delete restrict,
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (publication_state = 'draft' and qa_status in ('pending', 'rejected'))
    or (publication_state in ('reviewed', 'published', 'superseded')
      and qa_status = 'verified' and reviewed_by is not null)
  ),
  unique (mapping_id, revision_number),
  unique (id, mapping_id, scheme)
);

create unique index fiscal_classification_mapping_one_published
  on fiscal_classification_mapping_revisions (mapping_id)
  where publication_state = 'published';

create table fiscal_classification_mapping_members (
  mapping_revision_id uuid not null,
  mapping_id uuid not null,
  scheme text not null,
  classification_id uuid not null,
  direction fiscal_classification_direction_enum not null,
  member_order integer not null check (member_order >= 1),
  created_at timestamptz not null default now(),
  primary key (mapping_revision_id, classification_id, direction),
  foreign key (mapping_revision_id, mapping_id, scheme)
    references fiscal_classification_mapping_revisions(
      id, mapping_id, scheme
    ) on delete restrict,
  foreign key (classification_id, scheme)
    references fiscal_classifications(id, scheme) on delete restrict,
  unique (mapping_revision_id, direction, member_order)
);

create table fiscal_classification_mapping_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid not null,
  scheme text not null,
  edition_source_occurrence_id uuid not null,
  edition_id uuid not null,
  ingestion_source_id uuid not null,
  source_mapping_key text not null
    check (nullif(btrim(source_mapping_key), '') is not null),
  created_at timestamptz not null default now(),
  foreign key (mapping_id, scheme)
    references fiscal_classification_mappings(id, scheme) on delete restrict,
  foreign key (edition_source_occurrence_id, edition_id, ingestion_source_id)
    references fiscal_source_document_edition_source_occurrences(
      id, edition_id, ingestion_source_id
    ) on delete restrict,
  unique (edition_source_occurrence_id, scheme, source_mapping_key),
  unique (
    id, mapping_id, scheme, edition_source_occurrence_id,
    edition_id, ingestion_source_id
  )
);

create table fiscal_classification_mapping_sources (
  id uuid primary key default gen_random_uuid(),
  mapping_revision_id uuid not null,
  mapping_id uuid not null,
  scheme text not null,
  mapping_source_occurrence_id uuid not null,
  edition_source_occurrence_id uuid not null,
  edition_observation_id uuid not null,
  edition_id uuid not null,
  ingestion_source_id uuid not null,
  source_version_id uuid not null,
  parse_run_id uuid,
  parse_run_identity_key text generated always as (
    coalesce(parse_run_id::text, 'manual')
  ) stored,
  evidence_revision integer not null default 1 check (evidence_revision >= 1),
  source_locator text,
  observed_mapping_text text not null
    check (nullif(btrim(observed_mapping_text), '') is not null),
  extraction_method extraction_method_enum not null,
  qa_status qa_status_enum not null default 'pending',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (mapping_revision_id, mapping_id, scheme)
    references fiscal_classification_mapping_revisions(
      id, mapping_id, scheme
    ) on delete restrict,
  foreign key (
    mapping_source_occurrence_id, mapping_id, scheme,
    edition_source_occurrence_id, edition_id, ingestion_source_id
  ) references fiscal_classification_mapping_source_occurrences(
    id, mapping_id, scheme, edition_source_occurrence_id,
    edition_id, ingestion_source_id
  ) on delete restrict,
  foreign key (
    edition_observation_id, edition_source_occurrence_id, edition_id,
    ingestion_source_id, source_version_id, parse_run_identity_key
  ) references fiscal_source_document_edition_observations(
    id, edition_source_occurrence_id, edition_id, ingestion_source_id,
    source_version_id, parse_run_identity_key
  ) on delete restrict,
  foreign key (parse_run_id, source_version_id)
    references ingestion_parse_runs(id, source_version_id) on delete restrict,
  check (
    (extraction_method = 'parser' and parse_run_id is not null
      and evidence_revision = 1)
    or (extraction_method = 'manual' and parse_run_id is null
      and nullif(btrim(source_locator), '') is not null)
  ),
  check ((verified_by is null) = (verified_at is null)),
  check (qa_status <> 'verified' or verified_by is not null),
  unique nulls not distinct (
    mapping_source_occurrence_id, source_version_id, parse_run_id,
    evidence_revision
  )
);

create table fiscal_event_bill_link_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null,
  fiscal_event_id uuid not null,
  edition_source_occurrence_id uuid not null,
  edition_id uuid not null,
  ingestion_source_id uuid not null,
  source_relation_key text not null
    check (nullif(btrim(source_relation_key), '') is not null),
  created_at timestamptz not null default now(),
  foreign key (link_id, fiscal_event_id)
    references fiscal_event_bill_links(id, fiscal_event_id) on delete restrict,
  foreign key (edition_source_occurrence_id, edition_id, ingestion_source_id)
    references fiscal_source_document_edition_source_occurrences(
      id, edition_id, ingestion_source_id
    ) on delete restrict,
  unique (edition_source_occurrence_id, source_relation_key),
  unique (
    id, link_id, fiscal_event_id, edition_source_occurrence_id,
    edition_id, ingestion_source_id
  )
);

create table fiscal_event_bill_link_sources (
  id uuid primary key default gen_random_uuid(),
  link_revision_id uuid not null,
  link_id uuid not null,
  fiscal_event_id uuid not null,
  link_source_occurrence_id uuid not null,
  edition_source_occurrence_id uuid not null,
  edition_observation_id uuid not null,
  edition_id uuid not null,
  ingestion_source_id uuid not null,
  source_version_id uuid not null,
  parse_run_id uuid,
  parse_run_identity_key text generated always as (
    coalesce(parse_run_id::text, 'manual')
  ) stored,
  evidence_revision integer not null default 1 check (evidence_revision >= 1),
  source_locator text,
  raw_bill_number text not null
    check (nullif(btrim(raw_bill_number), '') is not null),
  raw_relationship text not null
    check (nullif(btrim(raw_relationship), '') is not null),
  extraction_method extraction_method_enum not null,
  qa_status qa_status_enum not null default 'pending',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (link_revision_id, link_id, fiscal_event_id)
    references fiscal_event_bill_link_revisions(
      id, link_id, fiscal_event_id
    )
    on delete restrict,
  foreign key (
    link_source_occurrence_id, link_id, fiscal_event_id,
    edition_source_occurrence_id, edition_id, ingestion_source_id
  ) references fiscal_event_bill_link_source_occurrences(
    id, link_id, fiscal_event_id, edition_source_occurrence_id,
    edition_id, ingestion_source_id
  ) on delete restrict,
  foreign key (
    edition_observation_id, edition_source_occurrence_id, edition_id,
    ingestion_source_id, source_version_id, parse_run_identity_key
  ) references fiscal_source_document_edition_observations(
    id, edition_source_occurrence_id, edition_id, ingestion_source_id,
    source_version_id, parse_run_identity_key
  ) on delete restrict,
  foreign key (parse_run_id, source_version_id)
    references ingestion_parse_runs(id, source_version_id) on delete restrict,
  check (
    (extraction_method = 'parser' and parse_run_id is not null
      and evidence_revision = 1)
    or (extraction_method = 'manual' and parse_run_id is null
      and nullif(btrim(source_locator), '') is not null)
  ),
  check ((verified_by is null) = (verified_at is null)),
  check (qa_status <> 'verified' or verified_by is not null),
  unique nulls not distinct (
    link_source_occurrence_id, source_version_id, parse_run_id,
    evidence_revision
  )
);

create table fiscal_source_kind_event_rules (
  event_kind fiscal_event_kind_enum not null,
  decision_stage fiscal_decision_stage_enum not null,
  source_kind fiscal_source_kind_enum not null,
  may_be_primary boolean not null default false,
  rationale text not null check (nullif(btrim(rationale), '') is not null),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (event_kind, decision_stage, source_kind),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (not may_be_primary or reviewed_by is not null),
  check (
    (event_kind in ('initial_budget', 'supplementary_budget')
      and decision_stage in ('proposed', 'passed'))
    or (event_kind in (
        'current_snapshot', 'available_budget_snapshot', 'settlement'
      ) and decision_stage = 'not_applicable')
  )
);

create trigger fiscal_coverage_account_year_guard
before insert or update of account_id, fiscal_year on fiscal_data_coverage
for each row execute function enforce_fiscal_account_year();

create trigger fiscal_coverage_publication_fail_closed
before insert or update of publication_state
on fiscal_data_coverage_observations
for each row execute function block_fiscal_publication_before_guards();

create trigger fiscal_mapping_publication_fail_closed
before insert or update of publication_state
on fiscal_classification_mapping_revisions
for each row execute function block_fiscal_publication_before_guards();

do $triggers$
declare table_name text;
begin
  foreach table_name in array array[
    'fiscal_data_coverage',
    'fiscal_data_coverage_source_occurrences',
    'fiscal_classification_source_occurrences',
    'fiscal_classification_mappings',
    'fiscal_classification_mapping_source_occurrences',
    'fiscal_event_bill_link_source_occurrences',
    'fiscal_source_kind_event_rules'
  ] loop
    execute format(
      'create trigger %I before update or delete on %I '
      || 'for each row execute function prevent_fiscal_stable_identity_mutation()',
      left(table_name, 35) || '_stable_mutation', table_name
    );
    execute format(
      'create trigger %I before truncate on %I '
      || 'for each statement execute function prevent_fiscal_stable_identity_mutation()',
      left(table_name, 35) || '_stable_truncate', table_name
    );
  end loop;

  foreach table_name in array array[
    'fiscal_data_coverage_observations',
    'fiscal_data_coverage_observation_sources',
    'fiscal_classification_sources',
    'fiscal_classification_mapping_revisions',
    'fiscal_classification_mapping_members',
    'fiscal_classification_mapping_sources',
    'fiscal_event_bill_link_sources'
  ] loop
    execute format(
      'create trigger %I before update or delete on %I '
      || 'for each row execute function prevent_fiscal_audit_snapshot_mutation()',
      left(table_name, 35) || '_audit_mutation', table_name
    );
    execute format(
      'create trigger %I before truncate on %I '
      || 'for each statement execute function prevent_fiscal_audit_snapshot_mutation()',
      left(table_name, 35) || '_audit_truncate', table_name
    );
  end loop;
end;
$triggers$;

alter table fiscal_data_coverage enable row level security;
alter table fiscal_data_coverage_source_occurrences enable row level security;
alter table fiscal_data_coverage_observations enable row level security;
alter table fiscal_data_coverage_observation_sources enable row level security;
alter table fiscal_classification_source_occurrences enable row level security;
alter table fiscal_classification_sources enable row level security;
alter table fiscal_classification_mappings enable row level security;
alter table fiscal_classification_mapping_revisions enable row level security;
alter table fiscal_classification_mapping_members enable row level security;
alter table fiscal_classification_mapping_source_occurrences
  enable row level security;
alter table fiscal_classification_mapping_sources enable row level security;
alter table fiscal_event_bill_link_source_occurrences enable row level security;
alter table fiscal_event_bill_link_sources enable row level security;
alter table fiscal_source_kind_event_rules enable row level security;

comment on table fiscal_data_coverage is
  '金額欠損とは別に、資料・分類・リンク等の収集対象を表す安定ID。';
comment on table fiscal_data_coverage_observations is
  '未公表、取得不能、部分取得、確認済み0件を履歴として区別する。';
comment on table fiscal_classification_mapping_revisions is
  '年度間の改称・分割・統合・比較上の同等関係を追記型で記録する。';
comment on table fiscal_source_kind_event_rules is
  'イベント段階ごとに一次根拠として利用できる資料種別と判断理由の対応表。';
