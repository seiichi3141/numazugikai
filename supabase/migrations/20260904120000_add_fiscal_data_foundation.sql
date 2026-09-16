-- Fiscal-data stable identities, revisions, evidence, and publication rules.
-- Depends on 20260903231500_add_common_ingestion_audit_foundation.sql.

create extension if not exists btree_gist with schema extensions;

create type fiscal_account_type_enum as enum (
  'general', 'special', 'public_enterprise'
);
create type fiscal_source_kind_enum as enum (
  'budget_overview', 'execution_report', 'settlement_report',
  'major_measures', 'fiscal_comparison', 'public_accounting'
);
create type fiscal_event_kind_enum as enum (
  'initial_budget', 'supplementary_budget', 'current_snapshot',
  'available_budget_snapshot', 'settlement'
);
create type fiscal_decision_stage_enum as enum (
  'proposed', 'passed', 'not_applicable'
);
create type fiscal_measure_enum as enum (
  'revenue_budget', 'expenditure_budget',
  'revenue_budget_delta', 'expenditure_budget_delta',
  'revenue_budget_after', 'expenditure_budget_after',
  'revenue_actual', 'expenditure_actual',
  'income', 'expense', 'asset', 'liability'
);
create type fiscal_source_unit_enum as enum (
  'yen', 'thousand_yen', 'ten_thousand_yen', 'million_yen',
  'hundred_million_yen'
);
create type fiscal_null_reason_enum as enum (
  'not_published', 'not_applicable', 'unreadable', 'suppressed',
  'unknown_dash'
);
create type fiscal_membership_role_enum as enum (
  'included', 'eliminated', 'reference_only'
);
create type fiscal_evidence_role_enum as enum (
  'primary', 'corroborating', 'calculation_input'
);
create type fiscal_bill_relationship_enum as enum (
  'proposes', 'passes', 'amends', 'recognizes', 'related_resolution'
);
create type fiscal_bill_match_method_enum as enum (
  'exact_fields', 'manual', 'imported', 'candidate'
);
create type fiscal_validation_scope_enum as enum (
  'source_parse', 'amount_set', 'cross_source'
);
create type fiscal_validation_severity_enum as enum (
  'info', 'warning', 'hard_error'
);
create type fiscal_validation_status_enum as enum (
  'pending', 'passed', 'reviewed', 'failed'
);
create type fiscal_validation_comparison_role_enum as enum (
  'baseline', 'compared', 'calculation_input', 'output'
);

create table fiscal_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null check (nullif(btrim(code), '') is not null),
  name text not null check (nullif(btrim(name), '') is not null),
  account_type fiscal_account_type_enum not null,
  valid_from_fiscal_year smallint not null,
  valid_to_fiscal_year smallint,
  predecessor_id uuid references fiscal_accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    valid_to_fiscal_year is null
    or valid_to_fiscal_year >= valid_from_fiscal_year
  ),
  check (predecessor_id is null or predecessor_id <> id),
  unique (code, valid_from_fiscal_year),
  unique (id, code)
);

alter table fiscal_accounts add constraint fiscal_accounts_periods_do_not_overlap
  exclude using gist (
    code with =,
    int4range(
      valid_from_fiscal_year::integer,
      case
        when valid_to_fiscal_year is null then null
        else valid_to_fiscal_year::integer + 1
      end,
      '[)'
    ) with &&
  );

create table fiscal_reporting_scopes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (nullif(btrim(code), '') is not null),
  name text not null check (nullif(btrim(name), '') is not null),
  description text not null check (nullif(btrim(description), '') is not null),
  created_at timestamptz not null default now(),
  unique (id, code)
);

create table fiscal_reporting_scope_memberships (
  id uuid primary key default gen_random_uuid(),
  reporting_scope_id uuid not null
    references fiscal_reporting_scopes(id) on delete restrict,
  fiscal_year smallint not null,
  account_id uuid references fiscal_accounts(id) on delete restrict,
  account_identity_key text generated always as (
    coalesce(account_id::text, 'scope-only')
  ) stored,
  member_key text not null check (nullif(btrim(member_key), '') is not null),
  created_at timestamptz not null default now(),
  check (
    account_id is null or member_key = 'account:' || account_id::text
  ),
  unique (reporting_scope_id, fiscal_year, member_key),
  unique (id, reporting_scope_id, fiscal_year, account_identity_key)
);

create unique index fiscal_scope_memberships_account_once
  on fiscal_reporting_scope_memberships (
    reporting_scope_id, fiscal_year, account_id
  ) where account_id is not null;

create table fiscal_source_documents (
  id uuid primary key default gen_random_uuid(),
  source_kind fiscal_source_kind_enum not null,
  series_code text not null unique
    check (nullif(btrim(series_code), '') is not null),
  created_at timestamptz not null default now(),
  unique (id, source_kind)
);

create table fiscal_source_document_editions (
  id uuid primary key default gen_random_uuid(),
  fiscal_source_document_id uuid not null
    references fiscal_source_documents(id) on delete restrict,
  edition_key text not null
    check (nullif(btrim(edition_key), '') is not null),
  created_at timestamptz not null default now(),
  unique (fiscal_source_document_id, edition_key),
  unique (id, fiscal_source_document_id)
);

create table fiscal_source_document_edition_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null,
  fiscal_source_document_id uuid not null,
  ingestion_source_id uuid not null
    references ingestion_sources(id) on delete restrict,
  source_edition_key text not null
    check (nullif(btrim(source_edition_key), '') is not null),
  created_at timestamptz not null default now(),
  foreign key (edition_id, fiscal_source_document_id)
    references fiscal_source_document_editions(
      id, fiscal_source_document_id
    ) on delete restrict,
  unique (ingestion_source_id, source_edition_key),
  unique (id, edition_id, ingestion_source_id)
);

create table fiscal_reporting_scope_membership_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null,
  reporting_scope_id uuid not null,
  fiscal_year smallint not null,
  account_id uuid references fiscal_accounts(id) on delete restrict,
  account_identity_key text generated always as (
    coalesce(account_id::text, 'scope-only')
  ) stored,
  edition_source_occurrence_id uuid not null,
  edition_id uuid not null,
  ingestion_source_id uuid not null,
  source_membership_key text not null
    check (nullif(btrim(source_membership_key), '') is not null),
  created_at timestamptz not null default now(),
  foreign key (
    membership_id, reporting_scope_id, fiscal_year, account_identity_key
  ) references fiscal_reporting_scope_memberships(
    id, reporting_scope_id, fiscal_year, account_identity_key
  ) on delete restrict,
  foreign key (edition_source_occurrence_id, edition_id, ingestion_source_id)
    references fiscal_source_document_edition_source_occurrences(
      id, edition_id, ingestion_source_id
    ) on delete restrict,
  unique (edition_source_occurrence_id, source_membership_key),
  unique (
    id, membership_id, reporting_scope_id, fiscal_year,
    account_identity_key, edition_source_occurrence_id, edition_id,
    ingestion_source_id
  )
);

create table fiscal_source_document_edition_observations (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null,
  fiscal_source_document_id uuid not null,
  edition_source_occurrence_id uuid not null,
  ingestion_source_id uuid not null,
  source_version_id uuid not null,
  parse_run_id uuid,
  parse_run_identity_key text generated always as (
    coalesce(parse_run_id::text, 'manual')
  ) stored,
  observation_revision integer not null check (observation_revision >= 1),
  evidence_revision integer not null default 1 check (evidence_revision >= 1),
  extraction_method extraction_method_enum not null,
  source_locator text,
  title text not null check (nullif(btrim(title), '') is not null),
  fiscal_year smallint,
  publisher text not null check (nullif(btrim(publisher), '') is not null),
  published_at timestamptz,
  as_of_date date,
  license_note text,
  redistribution_allowed boolean,
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (edition_id, fiscal_source_document_id)
    references fiscal_source_document_editions(
      id, fiscal_source_document_id
    ) on delete restrict,
  foreign key (
    edition_source_occurrence_id, edition_id, ingestion_source_id
  ) references fiscal_source_document_edition_source_occurrences(
    id, edition_id, ingestion_source_id
  ) on delete restrict,
  foreign key (source_version_id, ingestion_source_id)
    references ingestion_source_versions(id, ingestion_source_id)
    on delete restrict,
  foreign key (parse_run_id, source_version_id)
    references ingestion_parse_runs(id, source_version_id) on delete restrict,
  check (
    (extraction_method = 'parser' and parse_run_id is not null
      and evidence_revision = 1)
    or (extraction_method = 'manual' and parse_run_id is null
      and nullif(btrim(source_locator), '') is not null)
  ),
  check ((verified_by is null) = (verified_at is null)),
  check (
    (publication_state = 'draft' and qa_status in ('pending', 'rejected'))
    or (publication_state in ('reviewed', 'published', 'superseded')
      and qa_status = 'verified' and verified_by is not null)
  ),
  unique (edition_id, observation_revision),
  unique (
    id, edition_source_occurrence_id, edition_id, ingestion_source_id,
    source_version_id, parse_run_identity_key
  ),
  unique nulls not distinct (
    edition_source_occurrence_id, source_version_id, parse_run_id,
    evidence_revision
  )
);

create unique index fiscal_document_edition_one_published
  on fiscal_source_document_edition_observations (edition_id)
  where publication_state = 'published';

create table fiscal_reporting_scope_membership_observations (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null,
  reporting_scope_id uuid not null,
  fiscal_year smallint not null,
  account_id uuid references fiscal_accounts(id) on delete restrict,
  account_identity_key text generated always as (
    coalesce(account_id::text, 'scope-only')
  ) stored,
  membership_source_occurrence_id uuid not null,
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
  extraction_method extraction_method_enum not null,
  membership_role fiscal_membership_role_enum not null,
  source_member_name text not null
    check (nullif(btrim(source_member_name), '') is not null),
  display_name text not null check (nullif(btrim(display_name), '') is not null),
  source_locator text,
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (
    membership_id, reporting_scope_id, fiscal_year, account_identity_key
  ) references fiscal_reporting_scope_memberships(
    id, reporting_scope_id, fiscal_year, account_identity_key
  ) on delete restrict,
  foreign key (
    membership_source_occurrence_id, membership_id, reporting_scope_id,
    fiscal_year, account_identity_key, edition_source_occurrence_id,
    edition_id, ingestion_source_id
  ) references fiscal_reporting_scope_membership_source_occurrences(
    id, membership_id, reporting_scope_id, fiscal_year,
    account_identity_key, edition_source_occurrence_id, edition_id,
    ingestion_source_id
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
  check (
    (publication_state = 'draft' and qa_status in ('pending', 'rejected'))
    or (publication_state in ('reviewed', 'published', 'superseded')
      and qa_status = 'verified' and verified_by is not null)
  ),
  unique (id, membership_id, reporting_scope_id, fiscal_year, account_identity_key),
  unique nulls not distinct (
    membership_source_occurrence_id, source_version_id, parse_run_id,
    evidence_revision
  )
);

create unique index fiscal_scope_membership_one_published
  on fiscal_reporting_scope_membership_observations (membership_id)
  where publication_state = 'published';

create table fiscal_events (
  id uuid primary key default gen_random_uuid(),
  fiscal_year smallint not null,
  reporting_scope_id uuid not null
    references fiscal_reporting_scopes(id) on delete restrict,
  account_id uuid references fiscal_accounts(id) on delete restrict,
  scope_membership_id uuid,
  account_identity_key text generated always as (
    coalesce(account_id::text, 'scope-only')
  ) stored,
  event_kind fiscal_event_kind_enum not null,
  supplement_sequence integer check (supplement_sequence >= 1),
  as_of_date date,
  created_at timestamptz not null default now(),
  check (
    (event_kind = 'supplementary_budget' and supplement_sequence is not null)
    or (event_kind <> 'supplementary_budget' and supplement_sequence is null)
  ),
  check (
    (event_kind in ('current_snapshot', 'available_budget_snapshot')
      and as_of_date is not null)
    or (event_kind not in ('current_snapshot', 'available_budget_snapshot')
      and as_of_date is null)
  ),
  check (
    (account_id is not null and scope_membership_id is not null)
    or (account_id is null and scope_membership_id is null)
  ),
  foreign key (
    scope_membership_id, reporting_scope_id, fiscal_year,
    account_identity_key
  ) references fiscal_reporting_scope_memberships(
    id, reporting_scope_id, fiscal_year, account_identity_key
  ) on delete restrict,
  unique nulls not distinct (
    fiscal_year, reporting_scope_id, account_id, event_kind,
    supplement_sequence, as_of_date
  ),
  unique (id, event_kind),
  unique (id, reporting_scope_id, fiscal_year, account_identity_key)
);

create table fiscal_classifications (
  id uuid primary key default gen_random_uuid(),
  scheme text not null check (nullif(btrim(scheme), '') is not null),
  canonical_key text not null
    check (nullif(btrim(canonical_key), '') is not null),
  created_at timestamptz not null default now(),
  unique (scheme, canonical_key),
  unique (id, scheme)
);

create table fiscal_classification_revisions (
  id uuid primary key default gen_random_uuid(),
  classification_id uuid not null,
  scheme text not null,
  revision_number integer not null check (revision_number >= 1),
  display_label text not null
    check (nullif(btrim(display_label), '') is not null),
  parent_classification_id uuid,
  valid_from_fiscal_year smallint not null,
  valid_to_fiscal_year smallint,
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (classification_id, scheme)
    references fiscal_classifications(id, scheme) on delete restrict,
  foreign key (parent_classification_id, scheme)
    references fiscal_classifications(id, scheme) on delete restrict,
  check (parent_classification_id is null
    or parent_classification_id <> classification_id),
  check (valid_to_fiscal_year is null
    or valid_to_fiscal_year >= valid_from_fiscal_year),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (publication_state = 'draft' and qa_status in ('pending', 'rejected'))
    or (publication_state in ('reviewed', 'published', 'superseded')
      and qa_status = 'verified' and reviewed_by is not null)
  ),
  unique (classification_id, revision_number),
  unique (id, classification_id, scheme)
);

alter table fiscal_classification_revisions
  add constraint fiscal_classification_published_periods_do_not_overlap
  exclude using gist (
    classification_id with =,
    int4range(
      valid_from_fiscal_year::integer,
      case
        when valid_to_fiscal_year is null then null
        else valid_to_fiscal_year::integer + 1
      end,
      '[)'
    ) with &&
  ) where (publication_state = 'published');

create table fiscal_amount_sets (
  id uuid primary key default gen_random_uuid(),
  fiscal_event_id uuid not null,
  event_kind fiscal_event_kind_enum not null,
  decision_stage fiscal_decision_stage_enum not null,
  created_at timestamptz not null default now(),
  foreign key (fiscal_event_id, event_kind)
    references fiscal_events(id, event_kind) on delete restrict,
  check (
    (event_kind in ('initial_budget', 'supplementary_budget')
      and decision_stage in ('proposed', 'passed'))
    or (event_kind in (
      'current_snapshot', 'available_budget_snapshot', 'settlement'
    ) and decision_stage = 'not_applicable')
  ),
  unique (fiscal_event_id, decision_stage),
  unique (id, fiscal_event_id, event_kind)
);

create table fiscal_amount_set_revisions (
  id uuid primary key default gen_random_uuid(),
  amount_set_id uuid not null,
  fiscal_event_id uuid not null,
  event_kind fiscal_event_kind_enum not null,
  revision_number integer not null check (revision_number >= 1),
  effective_on date,
  scope_membership_id uuid,
  membership_observation_id uuid,
  reporting_scope_id uuid not null,
  fiscal_year smallint not null,
  account_id uuid references fiscal_accounts(id) on delete restrict,
  account_identity_key text generated always as (
    coalesce(account_id::text, 'scope-only')
  ) stored,
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (amount_set_id, fiscal_event_id, event_kind)
    references fiscal_amount_sets(id, fiscal_event_id, event_kind)
    on delete restrict,
  foreign key (
    fiscal_event_id, reporting_scope_id, fiscal_year, account_identity_key
  ) references fiscal_events(
    id, reporting_scope_id, fiscal_year, account_identity_key
  ) on delete restrict,
  foreign key (
    membership_observation_id, scope_membership_id, reporting_scope_id,
    fiscal_year, account_identity_key
  ) references fiscal_reporting_scope_membership_observations(
    id, membership_id, reporting_scope_id, fiscal_year,
    account_identity_key
  ) on delete restrict,
  check (
    (account_id is not null and scope_membership_id is not null
      and membership_observation_id is not null)
    or (account_id is null and scope_membership_id is null
      and membership_observation_id is null)
  ),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (
    (publication_state = 'draft' and qa_status in ('pending', 'rejected'))
    or (publication_state in ('reviewed', 'published', 'superseded')
      and qa_status = 'verified' and reviewed_by is not null)
  ),
  unique (amount_set_id, revision_number),
  unique (id, amount_set_id, fiscal_event_id),
  unique (id, amount_set_id)
);

create unique index fiscal_amount_set_one_published_revision
  on fiscal_amount_set_revisions (amount_set_id)
  where publication_state = 'published';

create table fiscal_amounts (
  id uuid primary key default gen_random_uuid(),
  amount_set_id uuid not null
    references fiscal_amount_sets(id) on delete restrict,
  created_for_amount_set_revision_id uuid not null,
  classification_id uuid references fiscal_classifications(id)
    on delete restrict,
  measure fiscal_measure_enum not null,
  created_at timestamptz not null default now(),
  foreign key (created_for_amount_set_revision_id, amount_set_id)
    references fiscal_amount_set_revisions(id, amount_set_id)
    on delete restrict,
  unique nulls not distinct (amount_set_id, classification_id, measure),
  unique (id, amount_set_id)
);

create table fiscal_amount_revisions (
  id uuid primary key default gen_random_uuid(),
  amount_id uuid not null,
  amount_set_id uuid not null,
  amount_set_revision_id uuid not null,
  revision_number integer not null check (revision_number >= 1),
  amount_yen bigint,
  null_reason fiscal_null_reason_enum,
  qa_status qa_status_enum not null default 'pending',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (amount_id, amount_set_id)
    references fiscal_amounts(id, amount_set_id) on delete restrict,
  foreign key (amount_set_revision_id, amount_set_id)
    references fiscal_amount_set_revisions(id, amount_set_id)
    on delete restrict,
  check ((amount_yen is null) <> (null_reason is null)),
  check ((verified_by is null) = (verified_at is null)),
  check (qa_status <> 'verified' or verified_by is not null),
  unique (amount_id, revision_number),
  unique (amount_id, amount_set_revision_id),
  unique (id, amount_id, amount_set_revision_id, amount_set_id)
);

create table fiscal_amount_set_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  amount_set_id uuid not null
    references fiscal_amount_sets(id) on delete restrict,
  edition_source_occurrence_id uuid not null,
  edition_id uuid not null,
  ingestion_source_id uuid not null,
  source_amount_set_key text not null
    check (nullif(btrim(source_amount_set_key), '') is not null),
  created_at timestamptz not null default now(),
  foreign key (edition_source_occurrence_id, edition_id, ingestion_source_id)
    references fiscal_source_document_edition_source_occurrences(
      id, edition_id, ingestion_source_id
    ) on delete restrict,
  unique (edition_source_occurrence_id, source_amount_set_key),
  unique (id, amount_set_id, ingestion_source_id),
  unique (id, amount_set_id, edition_id, ingestion_source_id),
  unique (
    id, amount_set_id, edition_source_occurrence_id, edition_id,
    ingestion_source_id
  ),
  unique (id, amount_set_id, edition_source_occurrence_id,
    ingestion_source_id)
);

create table fiscal_amount_set_sources (
  id uuid primary key default gen_random_uuid(),
  amount_set_id uuid not null,
  amount_set_revision_id uuid not null,
  amount_set_source_occurrence_id uuid not null,
  edition_source_occurrence_id uuid not null,
  edition_observation_id uuid not null,
  edition_id uuid not null,
  ingestion_source_id uuid not null,
  source_version_id uuid not null,
  parse_run_id uuid,
  parse_run_identity_key text generated always as (
    coalesce(parse_run_id::text, 'manual')
  ) stored,
  extraction_method extraction_method_enum not null,
  evidence_revision integer not null default 1 check (evidence_revision >= 1),
  evidence_role fiscal_evidence_role_enum not null,
  source_locator text,
  qa_status qa_status_enum not null default 'pending',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (amount_set_revision_id, amount_set_id)
    references fiscal_amount_set_revisions(id, amount_set_id)
    on delete restrict,
  foreign key (
    amount_set_source_occurrence_id, amount_set_id,
    edition_source_occurrence_id, edition_id, ingestion_source_id
  ) references fiscal_amount_set_source_occurrences(
    id, amount_set_id, edition_source_occurrence_id, edition_id,
    ingestion_source_id
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
  unique (id, amount_set_revision_id, amount_set_id),
  unique (
    id, amount_set_revision_id, amount_set_id,
    amount_set_source_occurrence_id, ingestion_source_id, source_version_id,
    parse_run_identity_key
  ),
  -- The target revision is intentionally absent: one physical interpretation
  -- cannot be reassigned. Reparse creates a new parse_run_id; a reviewed
  -- manual reinterpretation increments evidence_revision.
  unique nulls not distinct (
    amount_set_source_occurrence_id, source_version_id, parse_run_id,
    evidence_revision
  )
);

create table fiscal_amount_source_occurrences (
  id uuid primary key default gen_random_uuid(),
  amount_id uuid not null,
  amount_set_id uuid not null,
  amount_set_source_occurrence_id uuid not null,
  ingestion_source_id uuid not null,
  source_amount_key text not null
    check (nullif(btrim(source_amount_key), '') is not null),
  created_at timestamptz not null default now(),
  foreign key (amount_id, amount_set_id)
    references fiscal_amounts(id, amount_set_id) on delete restrict,
  foreign key (
    amount_set_source_occurrence_id, amount_set_id, ingestion_source_id
  ) references fiscal_amount_set_source_occurrences(
    id, amount_set_id, ingestion_source_id
  ) on delete restrict,
  unique (amount_set_source_occurrence_id, source_amount_key),
  unique (id, amount_id, amount_set_id, amount_set_source_occurrence_id,
    ingestion_source_id)
);

create table fiscal_amount_evidence (
  id uuid primary key default gen_random_uuid(),
  amount_id uuid not null,
  amount_set_id uuid not null,
  amount_revision_id uuid not null,
  amount_set_revision_id uuid not null,
  amount_source_occurrence_id uuid not null,
  amount_set_source_occurrence_id uuid not null,
  ingestion_source_id uuid not null,
  amount_set_source_id uuid not null,
  source_version_id uuid not null,
  parse_run_id uuid,
  parse_run_identity_key text generated always as (
    coalesce(parse_run_id::text, 'manual')
  ) stored,
  evidence_revision integer not null default 1 check (evidence_revision >= 1),
  source_value_text text,
  source_value_numeric numeric,
  source_unit fiscal_source_unit_enum,
  normalized_amount_yen bigint,
  normalized_null_reason fiscal_null_reason_enum,
  source_page text,
  source_table text,
  source_cell text,
  confidence numeric check (confidence is null or confidence between 0 and 1),
  qa_status qa_status_enum not null default 'pending',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (
    amount_revision_id, amount_id, amount_set_revision_id, amount_set_id
  ) references fiscal_amount_revisions(
    id, amount_id, amount_set_revision_id, amount_set_id
  ) on delete restrict,
  foreign key (
    amount_source_occurrence_id, amount_id, amount_set_id,
    amount_set_source_occurrence_id, ingestion_source_id
  ) references fiscal_amount_source_occurrences(
    id, amount_id, amount_set_id, amount_set_source_occurrence_id,
    ingestion_source_id
  ) on delete restrict,
  foreign key (
    amount_set_source_id, amount_set_revision_id, amount_set_id,
    amount_set_source_occurrence_id, ingestion_source_id, source_version_id,
    parse_run_identity_key
  ) references fiscal_amount_set_sources(
    id, amount_set_revision_id, amount_set_id,
    amount_set_source_occurrence_id, ingestion_source_id, source_version_id,
    parse_run_identity_key
  ) on delete restrict,
  foreign key (source_version_id, ingestion_source_id)
    references ingestion_source_versions(id, ingestion_source_id)
    on delete restrict,
  foreign key (parse_run_id, source_version_id)
    references ingestion_parse_runs(id, source_version_id) on delete restrict,
  check ((normalized_amount_yen is null)
    <> (normalized_null_reason is null)),
  check (source_value_numeric is null or source_unit is not null),
  check ((verified_by is null) = (verified_at is null)),
  check (qa_status <> 'verified' or verified_by is not null),
  unique nulls not distinct (
    amount_source_occurrence_id, source_version_id, parse_run_id,
    evidence_revision
  )
);

create table fiscal_event_bill_links (
  id uuid primary key default gen_random_uuid(),
  fiscal_event_id uuid not null references fiscal_events(id) on delete restrict,
  link_key text not null check (nullif(btrim(link_key), '') is not null),
  created_at timestamptz not null default now(),
  unique (fiscal_event_id, link_key),
  unique (id, fiscal_event_id)
);

create table fiscal_event_bill_link_revisions (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null,
  fiscal_event_id uuid not null,
  revision_number integer not null check (revision_number >= 1),
  bill_id uuid not null references bills(id) on delete restrict,
  relationship fiscal_bill_relationship_enum not null,
  match_method fiscal_bill_match_method_enum not null,
  confidence numeric check (confidence is null or confidence between 0 and 1),
  evidence_summary text not null
    check (nullif(btrim(evidence_summary), '') is not null),
  qa_status qa_status_enum not null default 'pending',
  publication_state publication_state_enum not null default 'draft',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (link_id, fiscal_event_id)
    references fiscal_event_bill_links(id, fiscal_event_id) on delete restrict,
  check ((verified_by is null) = (verified_at is null)),
  check (
    (match_method = 'candidate' and publication_state = 'draft'
      and qa_status = 'pending')
    or match_method <> 'candidate'
  ),
  check (
    (publication_state = 'draft' and qa_status in ('pending', 'rejected'))
    or (publication_state in ('reviewed', 'published', 'superseded')
      and qa_status = 'verified' and verified_by is not null)
  ),
  unique (link_id, revision_number)
);

create unique index fiscal_event_bill_link_one_published
  on fiscal_event_bill_link_revisions (link_id)
  where publication_state = 'published';

create table fiscal_validation_results (
  id uuid primary key default gen_random_uuid(),
  validation_scope fiscal_validation_scope_enum not null,
  parse_run_id uuid,
  source_version_id uuid,
  amount_set_id uuid,
  amount_set_revision_id uuid,
  rule_code text not null check (nullif(btrim(rule_code), '') is not null),
  severity fiscal_validation_severity_enum not null,
  status fiscal_validation_status_enum not null default 'pending',
  expected_value numeric,
  actual_value numeric,
  difference numeric,
  tolerance numeric check (tolerance is null or tolerance >= 0),
  details jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (parse_run_id, source_version_id)
    references ingestion_parse_runs(id, source_version_id) on delete restrict,
  foreign key (amount_set_revision_id, amount_set_id)
    references fiscal_amount_set_revisions(id, amount_set_id)
    on delete restrict,
  check (
    (validation_scope = 'source_parse' and parse_run_id is not null
      and source_version_id is not null and amount_set_id is null
      and amount_set_revision_id is null)
    or (validation_scope in ('amount_set', 'cross_source')
      and parse_run_id is null and source_version_id is null
      and amount_set_id is not null and amount_set_revision_id is not null)
  ),
  check (validation_scope <> 'cross_source'),
  check ((reviewed_by is null) = (reviewed_at is null)),
  check (status <> 'reviewed' or reviewed_by is not null),
  unique (id, amount_set_revision_id, amount_set_id)
);

alter table fiscal_amount_evidence add constraint
  fiscal_amount_evidence_revision_identity_unique
  unique (id, amount_set_revision_id, amount_set_id);

create table fiscal_validation_result_evidence (
  validation_result_id uuid not null,
  amount_set_revision_id uuid not null,
  amount_set_id uuid not null,
  amount_evidence_id uuid not null,
  comparison_role fiscal_validation_comparison_role_enum not null,
  created_at timestamptz not null default now(),
  primary key (
    validation_result_id, amount_evidence_id, comparison_role
  ),
  foreign key (
    validation_result_id, amount_set_revision_id, amount_set_id
  ) references fiscal_validation_results(
    id, amount_set_revision_id, amount_set_id
  ) on delete restrict,
  foreign key (
    amount_evidence_id, amount_set_revision_id, amount_set_id
  ) references fiscal_amount_evidence(
    id, amount_set_revision_id, amount_set_id
  ) on delete restrict
);

create function enforce_fiscal_account_year()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.account_id is null then
    return new;
  end if;

  perform 1
  from public.fiscal_accounts account
  where account.id = new.account_id
    and account.valid_from_fiscal_year <= new.fiscal_year
    and (
      account.valid_to_fiscal_year is null
      or account.valid_to_fiscal_year >= new.fiscal_year
    );

  if not found then
    raise exception 'fiscal account is not valid for fiscal year %',
      new.fiscal_year;
  end if;
  return new;
end;
$$;

create trigger fiscal_scope_membership_account_year_guard
before insert or update of account_id, fiscal_year
on fiscal_reporting_scope_memberships
for each row execute function enforce_fiscal_account_year();

create trigger fiscal_event_account_year_guard
before insert or update of account_id, fiscal_year on fiscal_events
for each row execute function enforce_fiscal_account_year();

create function prevent_fiscal_stable_identity_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% stable identity is append-only', tg_table_name;
end;
$$;

create function prevent_fiscal_audit_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% audit snapshot is append-only', tg_table_name;
end;
$$;

create function block_fiscal_publication_before_guards()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.publication_state = 'published' then
    raise exception
      'fiscal publication is disabled until evidence guards are installed';
  end if;
  return new;
end;
$$;

create trigger fiscal_document_publication_fail_closed
before insert or update of publication_state
on fiscal_source_document_edition_observations
for each row execute function block_fiscal_publication_before_guards();
create trigger fiscal_membership_publication_fail_closed
before insert or update of publication_state
on fiscal_reporting_scope_membership_observations
for each row execute function block_fiscal_publication_before_guards();
create trigger fiscal_classification_publication_fail_closed
before insert or update of publication_state
on fiscal_classification_revisions
for each row execute function block_fiscal_publication_before_guards();
create trigger fiscal_amount_set_publication_fail_closed
before insert or update of publication_state
on fiscal_amount_set_revisions
for each row execute function block_fiscal_publication_before_guards();
create trigger fiscal_bill_link_publication_fail_closed
before insert or update of publication_state
on fiscal_event_bill_link_revisions
for each row execute function block_fiscal_publication_before_guards();

do $$
declare table_name text;
begin
  -- Account validity is immutable through application traffic. A future
  -- legal closure or period correction must use a reviewed migration that
  -- temporarily replaces this guard and preserves the old schema history.
  foreach table_name in array array[
    'fiscal_accounts',
    'fiscal_reporting_scopes',
    'fiscal_reporting_scope_memberships',
    'fiscal_source_documents',
    'fiscal_source_document_editions',
    'fiscal_source_document_edition_source_occurrences',
    'fiscal_reporting_scope_membership_source_occurrences',
    'fiscal_events',
    'fiscal_classifications',
    'fiscal_amount_sets',
    'fiscal_amounts',
    'fiscal_amount_set_source_occurrences',
    'fiscal_amount_source_occurrences',
    'fiscal_event_bill_links'
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
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'fiscal_source_document_edition_observations',
    'fiscal_reporting_scope_membership_observations',
    'fiscal_classification_revisions',
    'fiscal_amount_set_revisions',
    'fiscal_amount_revisions',
    'fiscal_amount_set_sources',
    'fiscal_amount_evidence',
    'fiscal_event_bill_link_revisions',
    'fiscal_validation_results',
    'fiscal_validation_result_evidence'
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
$$;

insert into source_artifact_consumer_types (
  consumer_type, description, registered_by_migration
) values (
  'fiscal_data',
  '公開中の予算・決算データが参照する取得原本',
  '20260904120000_add_fiscal_data_foundation.sql'
);

insert into fiscal_accounts (
  code, name, account_type, valid_from_fiscal_year
) values (
  'general', '一般会計', 'general', 1900
);

insert into fiscal_reporting_scopes (code, name, description) values
  (
    'general_account', '一般会計',
    '地方自治法上の沼津市一般会計。普通会計とは区別する。'
  ),
  (
    'all_accounts', '全会計合計',
    '公式資料が同一収支側で示す全会計合計。独自合算しない。'
  ),
  (
    'ordinary_account', '普通会計',
    '自治体間比較用の統計上の会計範囲。一般会計とは区別する。'
  );

alter table fiscal_accounts enable row level security;
alter table fiscal_reporting_scopes enable row level security;
alter table fiscal_reporting_scope_memberships enable row level security;
alter table fiscal_source_documents enable row level security;
alter table fiscal_source_document_editions enable row level security;
alter table fiscal_source_document_edition_source_occurrences
  enable row level security;
alter table fiscal_reporting_scope_membership_source_occurrences
  enable row level security;
alter table fiscal_source_document_edition_observations
  enable row level security;
alter table fiscal_reporting_scope_membership_observations
  enable row level security;
alter table fiscal_events enable row level security;
alter table fiscal_classifications enable row level security;
alter table fiscal_classification_revisions enable row level security;
alter table fiscal_amount_sets enable row level security;
alter table fiscal_amount_set_revisions enable row level security;
alter table fiscal_amounts enable row level security;
alter table fiscal_amount_revisions enable row level security;
alter table fiscal_amount_set_source_occurrences enable row level security;
alter table fiscal_amount_set_sources enable row level security;
alter table fiscal_amount_source_occurrences enable row level security;
alter table fiscal_amount_evidence enable row level security;
alter table fiscal_event_bill_links enable row level security;
alter table fiscal_event_bill_link_revisions enable row level security;
alter table fiscal_validation_results enable row level security;
alter table fiscal_validation_result_evidence enable row level security;

revoke all on function enforce_fiscal_account_year(),
  prevent_fiscal_stable_identity_mutation(),
  prevent_fiscal_audit_snapshot_mutation(),
  block_fiscal_publication_before_guards()
  from public, anon, authenticated, service_role;

comment on table fiscal_accounts is
  '年度有効期間を持つ法定会計の安定ID。普通会計は含めない。';
comment on table fiscal_events is
  '年度、会計範囲、会計、金額段階で識別する財政イベント。';
comment on table fiscal_amount_set_revisions is
  '提案・可決・実績ごとの訂正可能な公開スナップショット。';
comment on table fiscal_amount_revisions is
  '円単位の正規値。0と欠損理由を排他的に保持する。';
comment on table fiscal_amount_evidence is
  '原単位、原表記、根拠位置から円換算値までを追跡する版別根拠。';
