-- Synchronize general-question parser evidence with the shared retention registry.

create function sync_general_question_revision_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consumer_type_value text;
  evidence_table_value text;
begin
  consumer_type_value := case tg_table_name
    when 'general_question_appearance_revisions'
      then 'general_question:appearance_revision'
    when 'general_question_item_revisions'
      then 'general_question:item_revision'
    when 'general_question_answerer_revisions'
      then 'general_question:answerer_revision'
    when 'general_question_session_coverage_observations'
      then 'general_question:session_coverage_observation'
  end;
  evidence_table_value := case tg_table_name
    when 'general_question_appearance_revisions'
      then 'general_question_appearance_sources'
    when 'general_question_item_revisions'
      then 'general_question_item_sources'
    when 'general_question_answerer_revisions'
      then 'general_question_answerer_sources'
    when 'general_question_session_coverage_observations'
      then 'general_question_session_coverage_observation_sources'
  end;

  update public.published_source_version_references
  set released_at = now()
  where consumer_type = consumer_type_value
    and consumer_id = new.id
    and released_at is null;

  if new.publication_state <> 'published' or new.qa_status <> 'verified' then
    return null;
  end if;

  if tg_table_name = 'general_question_appearance_revisions' then
    insert into public.published_source_version_references (
      consumer_type, consumer_id, evidence_table, evidence_id, source_version_id
    ) select consumer_type_value, new.id, evidence_table_value, source.id,
        source.source_version_id
      from public.general_question_appearance_sources source
      where source.appearance_revision_id = new.id
        and source.extraction_method = 'parser'
        and source.qa_status = 'verified';
  elsif tg_table_name = 'general_question_item_revisions' then
    insert into public.published_source_version_references (
      consumer_type, consumer_id, evidence_table, evidence_id, source_version_id
    ) select consumer_type_value, new.id, evidence_table_value, source.id,
        appearance_source.source_version_id
      from public.general_question_item_sources source
      join public.general_question_appearance_sources appearance_source
        on appearance_source.id = source.appearance_source_id
      where source.question_item_revision_id = new.id
        and appearance_source.extraction_method = 'parser'
        and source.qa_status = 'verified';
  elsif tg_table_name = 'general_question_answerer_revisions' then
    insert into public.published_source_version_references (
      consumer_type, consumer_id, evidence_table, evidence_id, source_version_id
    ) select consumer_type_value, new.id, evidence_table_value, source.id,
        appearance_source.source_version_id
      from public.general_question_answerer_sources source
      join public.general_question_appearance_sources appearance_source
        on appearance_source.id = source.appearance_source_id
      where source.answerer_revision_id = new.id
        and appearance_source.extraction_method = 'parser'
        and source.qa_status = 'verified';
  else
    insert into public.published_source_version_references (
      consumer_type, consumer_id, evidence_table, evidence_id, source_version_id
    ) select consumer_type_value, new.id, evidence_table_value, source.id,
        source.source_version_id
      from public.general_question_session_coverage_observation_sources source
      where source.observation_id = new.id
        and source.extraction_method = 'parser'
        and source.qa_status = 'verified';
  end if;
  return null;
end;
$$;

create function sync_general_question_evidence_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consumer_type_value text;
  evidence_table_value text := tg_table_name;
  consumer_id_value uuid;
  source_version_id_value uuid;
  is_parser boolean;
  is_verified boolean;
begin
  consumer_type_value := case tg_table_name
    when 'general_question_appearance_sources'
      then 'general_question:appearance_revision'
    when 'general_question_item_sources'
      then 'general_question:item_revision'
    when 'general_question_answerer_sources'
      then 'general_question:answerer_revision'
    when 'general_question_session_coverage_observation_sources'
      then 'general_question:session_coverage_observation'
  end;

  if tg_op in ('UPDATE', 'DELETE') then
    update public.published_source_version_references
    set released_at = now()
    where consumer_type = consumer_type_value
      and evidence_table = evidence_table_value
      and evidence_id = old.id
      and released_at is null;
  end if;
  if tg_op = 'DELETE' then return null; end if;

  if tg_table_name = 'general_question_appearance_sources' then
    consumer_id_value := new.appearance_revision_id;
    source_version_id_value := new.source_version_id;
    is_parser := new.extraction_method = 'parser';
    is_verified := new.qa_status = 'verified';
  elsif tg_table_name = 'general_question_item_sources' then
    consumer_id_value := new.question_item_revision_id;
    select source.source_version_id, source.extraction_method = 'parser'
      into source_version_id_value, is_parser
      from public.general_question_appearance_sources source
      where source.id = new.appearance_source_id;
    is_verified := new.qa_status = 'verified';
  elsif tg_table_name = 'general_question_answerer_sources' then
    consumer_id_value := new.answerer_revision_id;
    select source.source_version_id, source.extraction_method = 'parser'
      into source_version_id_value, is_parser
      from public.general_question_appearance_sources source
      where source.id = new.appearance_source_id;
    is_verified := new.qa_status = 'verified';
  else
    consumer_id_value := new.observation_id;
    source_version_id_value := new.source_version_id;
    is_parser := new.extraction_method = 'parser';
    is_verified := new.qa_status = 'verified';
  end if;

  if is_parser and is_verified and exists (
    select 1 from (
      select id, qa_status, publication_state
      from public.general_question_appearance_revisions
      union all select id, qa_status, publication_state
      from public.general_question_item_revisions
      union all select id, qa_status, publication_state
      from public.general_question_answerer_revisions
      union all select id, qa_status, publication_state
      from public.general_question_session_coverage_observations
    ) revision
    where revision.id = consumer_id_value
      and revision.qa_status = 'verified'
      and revision.publication_state = 'published'
  ) then
    insert into public.published_source_version_references (
      consumer_type, consumer_id, evidence_table, evidence_id, source_version_id
    ) values (
      consumer_type_value, consumer_id_value, evidence_table_value, new.id,
      source_version_id_value
    );
  end if;
  return null;
end;
$$;

do $sync_triggers$
declare
  table_name text;
begin
  foreach table_name in array array[
    'general_question_appearance_revisions',
    'general_question_item_revisions',
    'general_question_answerer_revisions',
    'general_question_session_coverage_observations'
  ] loop
    execute format(
      'create trigger %I after update of qa_status, publication_state on %I for each row execute function sync_general_question_revision_references()',
      table_name || '_sync_source_registry', table_name
    );
  end loop;
  foreach table_name in array array[
    'general_question_appearance_sources',
    'general_question_item_sources',
    'general_question_answerer_sources',
    'general_question_session_coverage_observation_sources'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on %I for each row execute function sync_general_question_evidence_reference()',
      table_name || '_sync_source_registry', table_name
    );
  end loop;
end
$sync_triggers$;

create function general_question_parent_publication_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'council_meeting_revisions' and exists (
    select 1
    from public.general_question_appearance_revisions appearance
    where appearance.meeting_id = coalesce(new.meeting_id, old.meeting_id)
      and appearance.publication_state = 'published'
      and not exists (
        select 1 from public.council_meeting_revisions meeting
        where meeting.meeting_id = appearance.meeting_id
          and meeting.publication_state = 'published'
          and meeting.qa_status = 'verified'
          and meeting.kind = 'plenary'
          and meeting.council_session_id is not null
          and meeting.committee_id is null
          and meeting.status in ('scheduled', 'held')
      )
  ) then
    raise exception 'published appearance requires an eligible published meeting';
  end if;
  return null;
end;
$$;

create constraint trigger council_meeting_general_question_dependents_valid
after insert or update or delete on council_meeting_revisions
deferrable initially deferred
for each row execute function general_question_parent_publication_guard();

-- Child guards use NEW/OLD.appearance_id and can therefore be attached directly.
create constraint trigger appearance_question_items_valid
after insert or update or delete on general_question_appearance_revisions
deferrable initially deferred
for each row execute function general_question_item_publication_guard();
create constraint trigger appearance_question_answerers_valid
after insert or update or delete on general_question_appearance_revisions
deferrable initially deferred
for each row execute function general_question_answerer_publication_guard();

revoke all on function sync_general_question_revision_references(),
  sync_general_question_evidence_reference(),
  general_question_parent_publication_guard()
  from public, anon, authenticated, service_role;
