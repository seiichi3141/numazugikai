-- Controlled fiscal publication, evidence guards, and source registry sync.

drop trigger if exists fiscal_document_publication_fail_closed
  on fiscal_source_document_edition_observations;
drop trigger if exists fiscal_membership_publication_fail_closed
  on fiscal_reporting_scope_membership_observations;
drop trigger if exists fiscal_classification_publication_fail_closed
  on fiscal_classification_revisions;
drop trigger if exists fiscal_amount_set_publication_fail_closed
  on fiscal_amount_set_revisions;
drop trigger if exists fiscal_bill_link_publication_fail_closed
  on fiscal_event_bill_link_revisions;
drop trigger if exists fiscal_coverage_publication_fail_closed
  on fiscal_data_coverage_observations;
drop trigger if exists fiscal_mapping_publication_fail_closed
  on fiscal_classification_mapping_revisions;

-- The foundation made every audit row immutable while publication was closed.
-- Publication rows now permit only reviewed state fields to move forward.
do $triggers$
declare
  table_name text;
  trigger_name text;
begin
  foreach table_name in array array[
    'fiscal_source_document_edition_observations',
    'fiscal_reporting_scope_membership_observations',
    'fiscal_data_coverage_observations',
    'fiscal_classification_revisions',
    'fiscal_classification_mapping_revisions',
    'fiscal_amount_set_revisions',
    'fiscal_event_bill_link_revisions'
  ] loop
    for trigger_name in
      select trigger.tgname
      from pg_trigger trigger
      join pg_proc procedure on procedure.oid = trigger.tgfoid
      where trigger.tgrelid = format('public.%I', table_name)::regclass
        and procedure.proname = 'prevent_fiscal_audit_snapshot_mutation'
        and (trigger.tgtype & 1) = 1
        and not trigger.tgisinternal
    loop
      execute format('drop trigger %I on public.%I', trigger_name, table_name);
    end loop;
  end loop;
end
$triggers$;

-- Child evidence can be assembled while its parent is draft. Once reviewed,
-- the complete snapshot is frozen and corrections require a new parent row.
do $triggers$
declare
  table_name text;
  trigger_name text;
begin
  foreach table_name in array array[
    'fiscal_data_coverage_observation_sources',
    'fiscal_classification_sources',
    'fiscal_classification_mapping_members',
    'fiscal_classification_mapping_sources',
    'fiscal_amount_revisions',
    'fiscal_amount_set_sources',
    'fiscal_amount_evidence',
    'fiscal_validation_results',
    'fiscal_validation_result_evidence',
    'fiscal_event_bill_link_sources'
  ] loop
    for trigger_name in
      select trigger.tgname
      from pg_trigger trigger
      join pg_proc procedure on procedure.oid = trigger.tgfoid
      where trigger.tgrelid = format('public.%I', table_name)::regclass
        and procedure.proname = 'prevent_fiscal_audit_snapshot_mutation'
        and (trigger.tgtype & 1) = 1
        and not trigger.tgisinternal
    loop
      execute format('drop trigger %I on public.%I', trigger_name, table_name);
    end loop;
  end loop;
end
$triggers$;

create function enforce_fiscal_publication_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_payload jsonb;
  new_payload jsonb;
  changed_fields text;
  reviewer_id uuid;
  reviewed_at_value timestamptz;
begin
  if tg_op = 'DELETE' then
    raise exception '% publication history is append-only', tg_table_name;
  end if;

  if tg_op = 'INSERT' then
    if new.publication_state <> 'draft' then
      raise exception 'fiscal publication rows must start as draft';
    end if;
    return new;
  end if;

  old_payload := to_jsonb(old)
    - 'qa_status' - 'publication_state'
    - 'reviewed_by' - 'reviewed_at' - 'verified_by' - 'verified_at'
    - 'parse_run_identity_key' - 'account_identity_key'
    - 'as_of_identity_key';
  new_payload := to_jsonb(new)
    - 'qa_status' - 'publication_state'
    - 'reviewed_by' - 'reviewed_at' - 'verified_by' - 'verified_at'
    - 'parse_run_identity_key' - 'account_identity_key'
    - 'as_of_identity_key';
  if old_payload is distinct from new_payload then
    select string_agg(coalesce(old_field.key, new_field.key), ', ')
    into changed_fields
    from jsonb_each(old_payload) old_field
    full join jsonb_each(new_payload) new_field using (key)
    where old_field.value is distinct from new_field.value;
    raise exception '% publication content is immutable: %',
      tg_table_name, changed_fields;
  end if;

  if old.publication_state <> 'draft'
    and (old.qa_status is distinct from new.qa_status
      or to_jsonb(old) -> 'reviewed_by'
        is distinct from to_jsonb(new) -> 'reviewed_by'
      or to_jsonb(old) -> 'reviewed_at'
        is distinct from to_jsonb(new) -> 'reviewed_at'
      or to_jsonb(old) -> 'verified_by'
        is distinct from to_jsonb(new) -> 'verified_by'
      or to_jsonb(old) -> 'verified_at'
        is distinct from to_jsonb(new) -> 'verified_at') then
    raise exception 'fiscal review metadata is immutable after review';
  end if;

  if not (
    new.publication_state = old.publication_state
    or (old.publication_state = 'draft'
      and new.publication_state = 'reviewed')
    or (old.publication_state = 'reviewed'
      and new.publication_state in ('published', 'superseded'))
    or (old.publication_state = 'published'
      and new.publication_state = 'superseded')
  ) then
    raise exception 'invalid fiscal publication transition';
  end if;

  reviewer_id := coalesce(
    (to_jsonb(new) ->> 'reviewed_by')::uuid,
    (to_jsonb(new) ->> 'verified_by')::uuid
  );
  reviewed_at_value := coalesce(
    (to_jsonb(new) ->> 'reviewed_at')::timestamptz,
    (to_jsonb(new) ->> 'verified_at')::timestamptz
  );
  if new.publication_state <> 'draft'
    and (new.qa_status <> 'verified'
      or reviewer_id is null or reviewed_at_value is null) then
    raise exception 'fiscal publication requires verified review metadata';
  end if;
  return new;
end;
$$;

create function enforce_fiscal_draft_child_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  row_payload jsonb := case when tg_op = 'DELETE'
    then to_jsonb(old) else to_jsonb(new) end;
  parent_revision_id uuid;
  parent_state public.publication_state_enum;
  old_payload jsonb;
  new_payload jsonb;
begin
  parent_revision_id := case tg_table_name
    when 'fiscal_data_coverage_observation_sources'
      then (row_payload ->> 'observation_id')::uuid
    when 'fiscal_classification_sources'
      then (row_payload ->> 'classification_revision_id')::uuid
    when 'fiscal_classification_mapping_members'
      then (row_payload ->> 'mapping_revision_id')::uuid
    when 'fiscal_classification_mapping_sources'
      then (row_payload ->> 'mapping_revision_id')::uuid
    when 'fiscal_amount_revisions'
      then (row_payload ->> 'amount_set_revision_id')::uuid
    when 'fiscal_amount_set_sources'
      then (row_payload ->> 'amount_set_revision_id')::uuid
    when 'fiscal_amount_evidence'
      then (row_payload ->> 'amount_set_revision_id')::uuid
    when 'fiscal_validation_results'
      then (row_payload ->> 'amount_set_revision_id')::uuid
    when 'fiscal_validation_result_evidence'
      then (row_payload ->> 'amount_set_revision_id')::uuid
    when 'fiscal_event_bill_link_sources'
      then (row_payload ->> 'link_revision_id')::uuid
  end;

  if tg_table_name = 'fiscal_validation_results'
    and parent_revision_id is null then
    parent_state := 'draft';
  elsif tg_table_name like 'fiscal_classification_mapping_%' then
    select publication_state into parent_state
    from public.fiscal_classification_mapping_revisions
    where id = parent_revision_id;
  elsif tg_table_name like 'fiscal_event_bill_link_%' then
    select publication_state into parent_state
    from public.fiscal_event_bill_link_revisions
    where id = parent_revision_id;
  elsif tg_table_name = 'fiscal_data_coverage_observation_sources' then
    select publication_state into parent_state
    from public.fiscal_data_coverage_observations
    where id = parent_revision_id;
  elsif tg_table_name = 'fiscal_classification_sources' then
    select publication_state into parent_state
    from public.fiscal_classification_revisions
    where id = parent_revision_id;
  else
    select publication_state into parent_state
    from public.fiscal_amount_set_revisions
    where id = parent_revision_id;
  end if;

  if parent_state is distinct from 'draft' then
    raise exception '% requires a draft fiscal parent', tg_table_name;
  end if;
  if tg_op = 'DELETE'
    and tg_table_name <> 'fiscal_classification_mapping_members' then
    raise exception '% evidence history is append-only', tg_table_name;
  end if;

  if tg_op = 'UPDATE'
    and tg_table_name <> 'fiscal_classification_mapping_members' then
    old_payload := to_jsonb(old)
      - 'qa_status' - 'verified_by' - 'verified_at'
      - 'status' - 'reviewed_by' - 'reviewed_at'
      - 'parse_run_identity_key' - 'account_identity_key'
      - 'as_of_identity_key';
    new_payload := to_jsonb(new)
      - 'qa_status' - 'verified_by' - 'verified_at'
      - 'status' - 'reviewed_by' - 'reviewed_at'
      - 'parse_run_identity_key' - 'account_identity_key'
      - 'as_of_identity_key';
    if old_payload is distinct from new_payload then
      raise exception '% evidence content is immutable', tg_table_name;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $triggers$
declare table_name text;
begin
  foreach table_name in array array[
    'fiscal_source_document_edition_observations',
    'fiscal_reporting_scope_membership_observations',
    'fiscal_data_coverage_observations',
    'fiscal_classification_revisions',
    'fiscal_classification_mapping_revisions',
    'fiscal_amount_set_revisions',
    'fiscal_event_bill_link_revisions'
  ] loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I '
      || 'for each row execute function enforce_fiscal_publication_transition()',
      left(table_name, 37) || '_publication_transition', table_name
    );
  end loop;
end
$triggers$;

do $triggers$
declare table_name text;
begin
  foreach table_name in array array[
    'fiscal_data_coverage_observation_sources',
    'fiscal_classification_sources',
    'fiscal_classification_mapping_members',
    'fiscal_classification_mapping_sources',
    'fiscal_amount_revisions',
    'fiscal_amount_set_sources',
    'fiscal_amount_evidence',
    'fiscal_validation_results',
    'fiscal_validation_result_evidence',
    'fiscal_event_bill_link_sources'
  ] loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I '
      || 'for each row execute function enforce_fiscal_draft_child_mutation()',
      left(table_name, 37) || '_draft_child_mutation', table_name
    );
  end loop;
end
$triggers$;

create view fiscal_expected_source_version_references
with (security_invoker = true)
as
select 'fiscal_data'::text consumer_type, observation.id consumer_id,
  'fiscal_source_document_edition_observations'::text evidence_table,
  observation.id evidence_id, observation.source_version_id
from fiscal_source_document_edition_observations observation
where observation.publication_state = 'published'
  and observation.qa_status = 'verified'
  and observation.extraction_method = 'parser'
union all
select 'fiscal_data', observation.id,
  'fiscal_reporting_scope_membership_observations', observation.id,
  observation.source_version_id
from fiscal_reporting_scope_membership_observations observation
where observation.publication_state = 'published'
  and observation.qa_status = 'verified'
  and observation.extraction_method = 'parser'
union all
select 'fiscal_data', observation.id,
  'fiscal_data_coverage_observation_sources', evidence.id,
  evidence.source_version_id
from fiscal_data_coverage_observations observation
join fiscal_data_coverage_observation_sources evidence
  on evidence.observation_id = observation.id
where observation.publication_state = 'published'
  and observation.qa_status = 'verified'
  and evidence.qa_status = 'verified'
  and evidence.extraction_method = 'parser'
union all
select 'fiscal_data', revision.id, 'fiscal_classification_sources',
  evidence.id, evidence.source_version_id
from fiscal_classification_revisions revision
join fiscal_classification_sources evidence
  on evidence.classification_revision_id = revision.id
where revision.publication_state = 'published'
  and revision.qa_status = 'verified'
  and evidence.qa_status = 'verified'
  and evidence.extraction_method = 'parser'
union all
select 'fiscal_data', revision.id,
  'fiscal_classification_mapping_sources', evidence.id,
  evidence.source_version_id
from fiscal_classification_mapping_revisions revision
join fiscal_classification_mapping_sources evidence
  on evidence.mapping_revision_id = revision.id
where revision.publication_state = 'published'
  and revision.qa_status = 'verified'
  and evidence.qa_status = 'verified'
  and evidence.extraction_method = 'parser'
union all
select 'fiscal_data', revision.id, 'fiscal_amount_set_sources', evidence.id,
  evidence.source_version_id
from fiscal_amount_set_revisions revision
join fiscal_amount_set_sources evidence
  on evidence.amount_set_revision_id = revision.id
where revision.publication_state = 'published'
  and revision.qa_status = 'verified'
  and evidence.qa_status = 'verified'
  and evidence.extraction_method = 'parser'
union all
select 'fiscal_data', revision.id, 'fiscal_amount_evidence', evidence.id,
  evidence.source_version_id
from fiscal_amount_set_revisions revision
join fiscal_amount_evidence evidence
  on evidence.amount_set_revision_id = revision.id
where revision.publication_state = 'published'
  and revision.qa_status = 'verified'
  and evidence.qa_status = 'verified'
  and evidence.parse_run_id is not null
union all
select 'fiscal_data', revision.id, 'fiscal_event_bill_link_sources',
  evidence.id, evidence.source_version_id
from fiscal_event_bill_link_revisions revision
join fiscal_event_bill_link_sources evidence
  on evidence.link_revision_id = revision.id
where revision.publication_state = 'published'
  and revision.qa_status = 'verified'
  and evidence.qa_status = 'verified'
  and evidence.extraction_method = 'parser';

revoke all on fiscal_expected_source_version_references
from public, anon, authenticated, service_role;

create function refresh_fiscal_source_registry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.published_source_version_references reference
  set released_at = now()
  where reference.consumer_type = 'fiscal_data'
    and reference.released_at is null
    and not exists (
      select 1
      from public.fiscal_expected_source_version_references expected
      where expected.consumer_type = reference.consumer_type
        and expected.consumer_id = reference.consumer_id
        and expected.evidence_table = reference.evidence_table
        and expected.evidence_id = reference.evidence_id
        and expected.source_version_id = reference.source_version_id
    );

  insert into public.published_source_version_references (
    consumer_type, consumer_id, evidence_table, evidence_id, source_version_id
  )
  select expected.consumer_type, expected.consumer_id,
    expected.evidence_table, expected.evidence_id, expected.source_version_id
  from public.fiscal_expected_source_version_references expected
  where not exists (
    select 1
    from public.published_source_version_references reference
    where reference.consumer_type = expected.consumer_type
      and reference.consumer_id = expected.consumer_id
      and reference.evidence_table = expected.evidence_table
      and reference.evidence_id = expected.evidence_id
      and reference.source_version_id = expected.source_version_id
      and reference.released_at is null
  );
  return null;
end;
$$;

create function enforce_fiscal_registry_completeness()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    with expected as (
      select * from public.fiscal_expected_source_version_references
    ), actual as (
      select consumer_type, consumer_id, evidence_table, evidence_id,
        source_version_id
      from public.published_source_version_references
      where consumer_type = 'fiscal_data' and released_at is null
    )
    select 1
    from (
      (select * from expected except select * from actual)
      union all
      (select * from actual except select * from expected)
    ) mismatch
  ) then
    raise exception 'fiscal parser evidence and source registry must match';
  end if;
  return null;
end;
$$;

create function fiscal_publication_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.fiscal_source_document_edition_observations observation
    where observation.publication_state = 'published'
      and (observation.qa_status <> 'verified'
        or (observation.extraction_method = 'parser' and not exists (
          select 1 from public.ingestion_parse_runs parse_run
          where parse_run.id = observation.parse_run_id
            and parse_run.source_version_id = observation.source_version_id
            and parse_run.status = 'completed'
        )))
  ) then
    raise exception 'published fiscal document requires completed verified evidence';
  end if;

  if exists (
    select 1
    from public.fiscal_reporting_scope_membership_observations membership
    where membership.publication_state = 'published'
      and not exists (
        select 1
        from public.fiscal_source_document_edition_observations edition
        where edition.id = membership.edition_observation_id
          and edition.publication_state = 'published'
          and edition.qa_status = 'verified'
          and edition.fiscal_year = membership.fiscal_year
      )
  ) then
    raise exception 'published fiscal membership requires a published edition';
  end if;

  if exists (
    select 1
    from public.fiscal_data_coverage_observations observation
    where observation.publication_state = 'published'
      and observation.state in ('collected', 'partial')
      and not exists (
        select 1
        from public.fiscal_data_coverage_observation_sources evidence
        join public.fiscal_source_document_edition_observations edition
          on edition.id = evidence.edition_observation_id
        join public.fiscal_source_document_editions stable_edition
          on stable_edition.id = evidence.edition_id
        join public.fiscal_source_documents document
          on document.id = stable_edition.fiscal_source_document_id
        where evidence.observation_id = observation.id
          and evidence.evidence_role = 'primary'
          and evidence.qa_status = 'verified'
          and evidence.observed_presence = observation.record_presence
          and edition.publication_state = 'published'
          and edition.qa_status = 'verified'
          and edition.fiscal_year = observation.fiscal_year
          and document.source_kind = observation.source_kind
      )
  ) then
    raise exception 'published fiscal coverage requires matching primary evidence';
  end if;

  if exists (
    select 1
    from public.fiscal_classification_revisions revision
    where revision.publication_state = 'published'
      and (not exists (
        select 1
        from public.fiscal_classification_sources evidence
        join public.fiscal_source_document_edition_observations edition
          on edition.id = evidence.edition_observation_id
        where evidence.classification_revision_id = revision.id
          and evidence.qa_status = 'verified'
          and evidence.observed_fiscal_year between revision.valid_from_fiscal_year
            and coalesce(revision.valid_to_fiscal_year, 32767)
          and edition.publication_state = 'published'
          and edition.qa_status = 'verified'
          and edition.fiscal_year = evidence.observed_fiscal_year
      ) or (revision.parent_classification_id is not null and not exists (
        select 1
        from public.fiscal_classification_revisions parent
        where parent.classification_id = revision.parent_classification_id
          and parent.publication_state = 'published'
          and parent.qa_status = 'verified'
          and parent.valid_from_fiscal_year <= revision.valid_from_fiscal_year
          and coalesce(parent.valid_to_fiscal_year, 32767)
            >= coalesce(revision.valid_to_fiscal_year, 32767)
      )))
  ) then
    raise exception 'published fiscal classification has invalid evidence or parent';
  end if;

  if exists (
    with recursive paths as (
      select revision.classification_id, revision.parent_classification_id,
        array[revision.classification_id] path, false cycle
      from public.fiscal_classification_revisions revision
      where revision.publication_state = 'published'
      union all
      select parent.classification_id, parent.parent_classification_id,
        child.path || parent.classification_id,
        parent.classification_id = any(child.path)
      from paths child
      join public.fiscal_classification_revisions parent
        on parent.classification_id = child.parent_classification_id
        and parent.publication_state = 'published'
      where not child.cycle
    )
    select 1 from paths where cycle
  ) then
    raise exception 'published fiscal classification hierarchy contains a cycle';
  end if;

  if exists (
    select 1
    from public.fiscal_classification_mapping_revisions revision
    where revision.publication_state = 'published'
      and (not exists (
        select 1
        from public.fiscal_classification_mapping_sources evidence
        join public.fiscal_source_document_edition_observations edition
          on edition.id = evidence.edition_observation_id
        where evidence.mapping_revision_id = revision.id
          and evidence.qa_status = 'verified'
          and edition.publication_state = 'published'
          and edition.qa_status = 'verified'
          and edition.fiscal_year = revision.effective_fiscal_year
      ) or (select count(*) from public.fiscal_classification_mapping_members member
          where member.mapping_revision_id = revision.id
            and member.direction = 'from') < 1
      or (select count(*) from public.fiscal_classification_mapping_members member
          where member.mapping_revision_id = revision.id
            and member.direction = 'to') < 1
      or (revision.relation_kind in ('rename', 'equivalent') and (
        (select count(*) from public.fiscal_classification_mapping_members member
          where member.mapping_revision_id = revision.id
            and member.direction = 'from') <> 1
        or (select count(*) from public.fiscal_classification_mapping_members member
          where member.mapping_revision_id = revision.id
            and member.direction = 'to') <> 1
      )) or (revision.relation_kind = 'split' and (
        (select count(*) from public.fiscal_classification_mapping_members member
          where member.mapping_revision_id = revision.id
            and member.direction = 'from') <> 1
        or (select count(*) from public.fiscal_classification_mapping_members member
          where member.mapping_revision_id = revision.id
            and member.direction = 'to') < 2
      )) or (revision.relation_kind = 'merge' and (
        (select count(*) from public.fiscal_classification_mapping_members member
          where member.mapping_revision_id = revision.id
            and member.direction = 'from') < 2
        or (select count(*) from public.fiscal_classification_mapping_members member
          where member.mapping_revision_id = revision.id
            and member.direction = 'to') <> 1
      )) or exists (
        select 1
        from public.fiscal_classification_mapping_members member
        where member.mapping_revision_id = revision.id
          and not exists (
            select 1 from public.fiscal_classification_revisions classification
            where classification.classification_id = member.classification_id
              and classification.publication_state = 'published'
              and classification.qa_status = 'verified'
              and ((member.direction = 'from'
                  and classification.valid_from_fiscal_year
                    <= revision.effective_fiscal_year - 1
                  and coalesce(classification.valid_to_fiscal_year, 32767)
                    >= revision.effective_fiscal_year - 1)
                or (member.direction = 'to'
                  and classification.valid_from_fiscal_year
                    <= revision.effective_fiscal_year
                  and coalesce(classification.valid_to_fiscal_year, 32767)
                    >= revision.effective_fiscal_year))
          )
      ))
  ) then
    raise exception 'published fiscal classification mapping is incomplete';
  end if;

  if exists (
    select 1
    from public.fiscal_amount_set_revisions revision
    join public.fiscal_amount_sets amount_set on amount_set.id = revision.amount_set_id
    where revision.publication_state = 'published'
      and (not exists (
        select 1
        from public.fiscal_amount_set_sources evidence
        join public.fiscal_source_document_editions edition
          on edition.id = evidence.edition_id
        join public.fiscal_source_documents document
          on document.id = edition.fiscal_source_document_id
        join public.fiscal_source_kind_event_rules rule
          on rule.event_kind = revision.event_kind
          and rule.decision_stage = amount_set.decision_stage
          and rule.source_kind = document.source_kind
          and rule.may_be_primary
        join public.fiscal_source_document_edition_observations edition_observation
          on edition_observation.id = evidence.edition_observation_id
        where evidence.amount_set_revision_id = revision.id
          and evidence.evidence_role = 'primary'
          and evidence.qa_status = 'verified'
          and edition_observation.publication_state = 'published'
          and edition_observation.qa_status = 'verified'
          and edition_observation.fiscal_year = revision.fiscal_year
      ) or not exists (
        select 1 from public.fiscal_amount_revisions amount_revision
        where amount_revision.amount_set_revision_id = revision.id
      ) or exists (
        select 1
        from public.fiscal_amount_revisions amount_revision
        join public.fiscal_amounts amount
          on amount.id = amount_revision.amount_id
        where amount_revision.amount_set_revision_id = revision.id
          and (amount_revision.qa_status <> 'verified' or not exists (
            select 1
            from public.fiscal_amount_evidence evidence
            join public.fiscal_amount_set_sources amount_set_source
              on amount_set_source.id = evidence.amount_set_source_id
            join public.fiscal_source_document_editions evidence_edition
              on evidence_edition.id = amount_set_source.edition_id
            join public.fiscal_source_documents evidence_document
              on evidence_document.id
                = evidence_edition.fiscal_source_document_id
            join public.fiscal_source_kind_event_rules evidence_rule
              on evidence_rule.event_kind = revision.event_kind
              and evidence_rule.decision_stage = amount_set.decision_stage
              and evidence_rule.source_kind = evidence_document.source_kind
              and evidence_rule.may_be_primary
            join public.fiscal_source_document_edition_observations
              evidence_edition_observation
              on evidence_edition_observation.id
                = amount_set_source.edition_observation_id
            where evidence.amount_revision_id = amount_revision.id
              and evidence.qa_status = 'verified'
              and amount_set_source.evidence_role = 'primary'
              and amount_set_source.qa_status = 'verified'
              and evidence_edition_observation.publication_state = 'published'
              and evidence_edition_observation.qa_status = 'verified'
              and evidence_edition_observation.fiscal_year
                = revision.fiscal_year
              and evidence.normalized_amount_yen
                is not distinct from amount_revision.amount_yen
              and evidence.normalized_null_reason
                is not distinct from amount_revision.null_reason
          ) or (amount.classification_id is not null and not exists (
            select 1
            from public.fiscal_classification_revisions classification
            where classification.classification_id = amount.classification_id
              and classification.publication_state = 'published'
              and classification.qa_status = 'verified'
              and classification.valid_from_fiscal_year <= revision.fiscal_year
              and coalesce(classification.valid_to_fiscal_year, 32767)
                >= revision.fiscal_year
          )))
      ) or (revision.account_id is not null and not exists (
        select 1
        from public.fiscal_reporting_scope_membership_observations membership
        where membership.id = revision.membership_observation_id
          and membership.publication_state = 'published'
          and membership.qa_status = 'verified'
          and membership.membership_role = 'included'
      )) or exists (
        select 1 from public.fiscal_validation_results validation
        where validation.amount_set_revision_id = revision.id
          and validation.severity in ('hard_error', 'warning')
          and validation.status not in ('passed', 'reviewed')
      ))
  ) then
    raise exception 'published fiscal amount set is incomplete';
  end if;

  if exists (
    select 1
    from public.fiscal_event_bill_link_revisions revision
    join public.bills bill on bill.id = revision.bill_id
    join public.fiscal_events event on event.id = revision.fiscal_event_id
    where revision.publication_state = 'published'
      and (revision.match_method = 'candidate'
        or bill.publish_status <> 'published'
        or not exists (
          select 1
          from public.fiscal_event_bill_link_sources evidence
          join public.fiscal_source_document_edition_observations edition
            on edition.id = evidence.edition_observation_id
          where evidence.link_revision_id = revision.id
            and evidence.qa_status = 'verified'
            and edition.publication_state = 'published'
            and edition.qa_status = 'verified'
            and edition.fiscal_year = event.fiscal_year
        ))
  ) then
    raise exception 'published fiscal bill link requires verified evidence';
  end if;
  return null;
end;
$$;

create constraint trigger bills_fiscal_dependents_valid
after update of publish_status on bills
deferrable initially deferred
for each row execute function fiscal_publication_guard();

do $triggers$
declare table_name text;
begin
  foreach table_name in array array[
    'fiscal_source_document_edition_observations',
    'fiscal_reporting_scope_membership_observations',
    'fiscal_data_coverage_observations',
    'fiscal_data_coverage_observation_sources',
    'fiscal_classification_revisions',
    'fiscal_classification_sources',
    'fiscal_classification_mapping_revisions',
    'fiscal_classification_mapping_members',
    'fiscal_classification_mapping_sources',
    'fiscal_amount_set_revisions',
    'fiscal_amount_revisions',
    'fiscal_amount_set_sources',
    'fiscal_amount_evidence',
    'fiscal_event_bill_link_revisions',
    'fiscal_event_bill_link_sources'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I '
      || 'for each statement execute function refresh_fiscal_source_registry()',
      left(table_name, 39) || '_refresh_registry', table_name
    );
    execute format(
      'create constraint trigger %I after insert or update or delete on public.%I '
      || 'deferrable initially deferred for each row '
      || 'execute function fiscal_publication_guard()',
      left(table_name, 37) || '_publication_guard', table_name
    );
    execute format(
      'create constraint trigger %I after insert or update or delete on public.%I '
      || 'deferrable initially deferred for each row '
      || 'execute function enforce_fiscal_registry_completeness()',
      left(table_name, 35) || '_registry_complete', table_name
    );
  end loop;
end
$triggers$;

create constraint trigger published_source_registry_fiscal_complete
after insert or update or delete on published_source_version_references
deferrable initially deferred
for each row execute function enforce_fiscal_registry_completeness();

alter table fiscal_validation_results
  drop constraint fiscal_validation_results_validation_scope_check;

create function fiscal_cross_source_validation_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.fiscal_validation_results validation
    where validation.validation_scope = 'cross_source'
      and validation.status in ('passed', 'reviewed')
      and not exists (
        select 1
        from public.fiscal_validation_result_evidence baseline_link
        join public.fiscal_amount_evidence baseline
          on baseline.id = baseline_link.amount_evidence_id
          and baseline.qa_status = 'verified'
        join public.fiscal_validation_result_evidence compared_link
          on compared_link.validation_result_id = validation.id
          and compared_link.comparison_role = 'compared'
        join public.fiscal_amount_evidence compared
          on compared.id = compared_link.amount_evidence_id
          and compared.qa_status = 'verified'
          and compared.ingestion_source_id <> baseline.ingestion_source_id
        where baseline_link.validation_result_id = validation.id
          and baseline_link.comparison_role = 'baseline'
      )
  ) then
    raise exception
      'cross-source fiscal validation requires two verified independent sources';
  end if;
  return null;
end;
$$;

create constraint trigger fiscal_validation_cross_source_complete
after insert or update or delete on fiscal_validation_results
deferrable initially deferred
for each row execute function fiscal_cross_source_validation_guard();

create constraint trigger fiscal_validation_evidence_cross_source_complete
after insert or update or delete on fiscal_validation_result_evidence
deferrable initially deferred
for each row execute function fiscal_cross_source_validation_guard();

create constraint trigger fiscal_amount_evidence_cross_source_complete
after insert or update or delete on fiscal_amount_evidence
deferrable initially deferred
for each row execute function fiscal_cross_source_validation_guard();

revoke all on function enforce_fiscal_publication_transition()
from public, anon, authenticated, service_role;
revoke all on function enforce_fiscal_draft_child_mutation()
from public, anon, authenticated, service_role;
revoke all on function fiscal_cross_source_validation_guard()
from public, anon, authenticated, service_role;
revoke all on function refresh_fiscal_source_registry()
from public, anon, authenticated, service_role;
revoke all on function enforce_fiscal_registry_completeness()
from public, anon, authenticated, service_role;
revoke all on function fiscal_publication_guard()
from public, anon, authenticated, service_role;
