-- Append-only controls and cross-table publication guards for general questions.

create function prevent_general_question_stable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'general question audit tables cannot be truncated';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'general question audit rows cannot be deleted';
  end if;
  if old is distinct from new then
    raise exception 'general question stable identity is immutable';
  end if;
  return new;
end;
$$;

create function enforce_general_question_revision_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(old) - array[
    'qa_status', 'publication_state', 'reviewed_by', 'reviewed_at',
    'published_at'
  ]) is distinct from (to_jsonb(new) - array[
    'qa_status', 'publication_state', 'reviewed_by', 'reviewed_at',
    'published_at'
  ]) then
    raise exception 'general question revision content is immutable';
  end if;
  if old.publication_state <> 'draft'
    and (new.qa_status <> 'verified'
      or new.reviewed_by is null or new.reviewed_at is null) then
    raise exception 'general question review metadata cannot be removed';
  end if;
  if not (
    new.publication_state = old.publication_state
    or (old.publication_state = 'draft' and new.publication_state = 'reviewed')
    or (old.publication_state = 'reviewed'
      and new.publication_state in ('published', 'superseded'))
    or (old.publication_state = 'published'
      and new.publication_state = 'superseded')
  ) then
    raise exception 'invalid general question publication transition';
  end if;
  return new;
end;
$$;

create function enforce_general_question_evidence_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(old) - array['qa_status', 'verified_by', 'verified_at'])
    is distinct from
    (to_jsonb(new) - array['qa_status', 'verified_by', 'verified_at']) then
    raise exception 'general question evidence content is immutable';
  end if;
  return new;
end;
$$;

do $triggers$
declare
  table_name text;
begin
  foreach table_name in array array[
    'general_question_appearances',
    'general_question_appearance_source_occurrences',
    'general_question_items',
    'general_question_item_source_occurrences',
    'general_question_answerers',
    'general_question_answerer_source_occurrences',
    'general_question_session_coverage',
    'general_question_session_coverage_source_occurrences'
  ] loop
    execute format(
      'create trigger %I before update or delete on %I for each row execute function prevent_general_question_stable_mutation()',
      table_name || '_immutable', table_name
    );
    execute format(
      'create trigger %I before truncate on %I for each statement execute function prevent_general_question_stable_mutation()',
      table_name || '_no_truncate', table_name
    );
  end loop;

  foreach table_name in array array[
    'general_question_appearance_revisions',
    'general_question_item_revisions',
    'general_question_answerer_revisions',
    'general_question_session_coverage_observations'
  ] loop
    execute format(
      'create trigger %I before update on %I for each row execute function enforce_general_question_revision_update()',
      table_name || '_controlled_update', table_name
    );
    execute format(
      'create trigger %I before delete on %I for each row execute function prevent_general_question_stable_mutation()',
      table_name || '_no_delete', table_name
    );
    execute format(
      'create trigger %I before truncate on %I for each statement execute function prevent_general_question_stable_mutation()',
      table_name || '_no_truncate', table_name
    );
  end loop;

  foreach table_name in array array[
    'general_question_appearance_sources',
    'general_question_item_sources',
    'general_question_answerer_sources',
    'general_question_session_coverage_observation_sources'
  ] loop
    execute format(
      'create trigger %I before update on %I for each row execute function enforce_general_question_evidence_update()',
      table_name || '_controlled_update', table_name
    );
    execute format(
      'create trigger %I before truncate on %I for each statement execute function prevent_general_question_stable_mutation()',
      table_name || '_no_truncate', table_name
    );
  end loop;
end
$triggers$;

create function general_question_appearance_publication_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_id uuid := case when tg_op = 'DELETE' then old.appearance_id
    else new.appearance_id end;
  revision public.general_question_appearance_revisions%rowtype;
begin
  select * into revision
  from public.general_question_appearance_revisions
  where appearance_id = target_id and publication_state = 'published';
  if not found then return null; end if;

  if revision.qa_status <> 'verified'
    or revision.reviewed_by is null or revision.reviewed_at is null
    or revision.published_at is null then
    raise exception 'published appearance must be reviewed';
  end if;
  if not exists (
    select 1
    from public.council_meeting_revisions meeting_revision
    where meeting_revision.meeting_id = revision.meeting_id
      and meeting_revision.publication_state = 'published'
      and meeting_revision.qa_status = 'verified'
      and meeting_revision.kind = 'plenary'
      and meeting_revision.council_session_id is not null
      and meeting_revision.committee_id is null
      and meeting_revision.status in ('scheduled', 'held')
  ) then
    raise exception 'published appearance requires an eligible published meeting';
  end if;
  if not exists (
    select 1 from public.general_question_appearance_sources source
    where source.appearance_revision_id = revision.id
      and source.appearance_id = revision.appearance_id
      and source.meeting_id = revision.meeting_id
      and source.qa_status = 'verified'
  ) then
    raise exception 'published appearance requires verified evidence';
  end if;
  return null;
end;
$$;

create function general_question_item_publication_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_appearance_id uuid := case when tg_op = 'DELETE'
    then old.appearance_id else new.appearance_id end;
begin
  if exists (
    select 1
    from public.general_question_item_revisions revision
    where revision.appearance_id = target_appearance_id
      and revision.publication_state = 'published'
      and (
        revision.qa_status <> 'verified'
        or revision.reviewed_by is null
        or revision.reviewed_at is null
        or not exists (
          select 1 from public.general_question_item_sources source
          where source.question_item_revision_id = revision.id
            and source.qa_status = 'verified'
        )
        or not exists (
          select 1 from public.general_question_appearance_revisions appearance
          where appearance.appearance_id = revision.appearance_id
            and appearance.publication_state = 'published'
            and appearance.qa_status = 'verified'
        )
        or (revision.parent_item_id is not null and not exists (
          select 1 from public.general_question_item_revisions parent
          where parent.question_item_id = revision.parent_item_id
            and parent.appearance_id = revision.appearance_id
            and parent.publication_state = 'published'
            and parent.qa_status = 'verified'
        ))
      )
  ) then
    raise exception 'published question item has invalid parent or evidence';
  end if;

  if exists (
    with recursive item_path as (
      select question_item_id, parent_item_id, array[question_item_id] as path,
        false as cycle
      from public.general_question_item_revisions
      where appearance_id = target_appearance_id
        and publication_state = 'published'
      union all
      select parent.question_item_id, parent.parent_item_id,
        child.path || parent.question_item_id,
        parent.question_item_id = any(child.path)
      from item_path child
      join public.general_question_item_revisions parent
        on parent.question_item_id = child.parent_item_id
        and parent.appearance_id = target_appearance_id
        and parent.publication_state = 'published'
      where not child.cycle
    ) select 1 from item_path where cycle
  ) then
    raise exception 'published question item hierarchy contains a cycle';
  end if;
  return null;
end;
$$;

create function general_question_answerer_publication_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_appearance_id uuid := case when tg_op = 'DELETE'
    then old.appearance_id else new.appearance_id end;
begin
  if exists (
    select 1
    from public.general_question_answerer_revisions revision
    where revision.appearance_id = target_appearance_id
      and revision.publication_state = 'published'
      and (
        revision.qa_status <> 'verified'
        or revision.reviewed_by is null
        or revision.reviewed_at is null
        or not exists (
          select 1 from public.general_question_answerer_sources source
          where source.answerer_revision_id = revision.id
            and source.qa_status = 'verified'
        )
        or not exists (
          select 1 from public.general_question_appearance_revisions appearance
          where appearance.appearance_id = revision.appearance_id
            and appearance.publication_state = 'published'
            and appearance.qa_status = 'verified'
        )
      )
  ) then
    raise exception 'published answerer requires a published appearance and evidence';
  end if;
  return null;
end;
$$;

create function general_question_coverage_publication_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_coverage_id uuid := case when tg_op = 'DELETE'
    then old.coverage_id else new.coverage_id end;
  observation public.general_question_session_coverage_observations%rowtype;
begin
  select * into observation
  from public.general_question_session_coverage_observations
  where coverage_id = target_coverage_id and publication_state = 'published';
  if not found then return null; end if;

  if observation.qa_status <> 'verified'
    or observation.reviewed_by is null or observation.reviewed_at is null then
    raise exception 'published coverage observation must be reviewed';
  end if;
  if (
    observation.state in ('collected', 'partial')
    or observation.session_disposition in ('held', 'not_held')
  ) and not exists (
    select 1
    from public.general_question_session_coverage_observation_sources source
    where source.observation_id = observation.id
      and source.coverage_id = observation.coverage_id
      and source.council_session_id = observation.council_session_id
      and source.source_kind = observation.source_kind
      and source.evidence_role = 'primary'
      and source.qa_status = 'verified'
  ) then
    raise exception 'published coverage requires verified primary evidence';
  end if;
  return null;
end;
$$;

do $guards$
declare
  table_name text;
begin
  foreach table_name in array array[
    'general_question_appearance_revisions',
    'general_question_appearance_sources'
  ] loop
    execute format(
      'create constraint trigger %I after insert or update or delete on %I deferrable initially deferred for each row execute function general_question_appearance_publication_guard()',
      table_name || '_publication_guard', table_name
    );
  end loop;
  foreach table_name in array array[
    'general_question_item_revisions', 'general_question_item_sources'
  ] loop
    execute format(
      'create constraint trigger %I after insert or update or delete on %I deferrable initially deferred for each row execute function general_question_item_publication_guard()',
      table_name || '_publication_guard', table_name
    );
  end loop;
  foreach table_name in array array[
    'general_question_answerer_revisions', 'general_question_answerer_sources'
  ] loop
    execute format(
      'create constraint trigger %I after insert or update or delete on %I deferrable initially deferred for each row execute function general_question_answerer_publication_guard()',
      table_name || '_publication_guard', table_name
    );
  end loop;
  foreach table_name in array array[
    'general_question_session_coverage_observations',
    'general_question_session_coverage_observation_sources'
  ] loop
    execute format(
      'create constraint trigger %I after insert or update or delete on %I deferrable initially deferred for each row execute function general_question_coverage_publication_guard()',
      table_name || '_publication_guard', table_name
    );
  end loop;
end
$guards$;

revoke update, delete, truncate on general_question_appearances,
  general_question_appearance_source_occurrences,
  general_question_items, general_question_item_source_occurrences,
  general_question_answerers, general_question_answerer_source_occurrences,
  general_question_session_coverage,
  general_question_session_coverage_source_occurrences
  from anon, authenticated, service_role;
revoke delete, truncate on general_question_appearance_revisions,
  general_question_appearance_sources, general_question_item_revisions,
  general_question_item_sources, general_question_answerer_revisions,
  general_question_answerer_sources,
  general_question_session_coverage_observations,
  general_question_session_coverage_observation_sources
  from anon, authenticated, service_role;

revoke all on function prevent_general_question_stable_mutation(),
  enforce_general_question_revision_update(),
  enforce_general_question_evidence_update(),
  general_question_appearance_publication_guard(),
  general_question_item_publication_guard(),
  general_question_answerer_publication_guard(),
  general_question_coverage_publication_guard()
  from public, anon, authenticated, service_role;
