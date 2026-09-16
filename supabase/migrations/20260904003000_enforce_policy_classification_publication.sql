-- Make taxonomy, classification, snapshot, and release publication append-only.

create function enforce_policy_classification_invariants()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_state public.publication_state_enum;
  run_state public.topic_classification_status_enum;
begin
  if tg_table_name = 'policy_taxonomies' then
    if tg_op = 'DELETE' and old.publication_state <> 'draft' then
      raise exception 'reviewed taxonomies are append-only';
    end if;
    if tg_op = 'UPDATE' then
      if old.publication_state <> 'draft' and (
        new.version is distinct from old.version
        or new.label is distinct from old.label
        or new.content_hash is distinct from old.content_hash
        or new.reviewed_by is distinct from old.reviewed_by
        or new.reviewed_at is distinct from old.reviewed_at
        or new.published_at is distinct from old.published_at
      ) then
        raise exception 'reviewed taxonomy content is immutable';
      end if;
      if old.publication_state <> 'draft'
        and new.publication_state = 'draft' then
        raise exception 'taxonomy cannot return to draft';
      end if;
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'policy_topics' then
    select publication_state into parent_state
    from public.policy_taxonomies
    where id = coalesce(new.taxonomy_id, old.taxonomy_id);
    if parent_state <> 'draft' then
      raise exception 'topics of a reviewed taxonomy are immutable';
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'topic_classification_runs' then
    if tg_op = 'INSERT' and (
      new.status <> 'running' or new.finished_at is not null
    ) then
      raise exception 'classification runs must start in running state';
    end if;
    if tg_op = 'UPDATE' then
      if old.status <> 'running' then
        raise exception 'terminal classification runs are immutable';
      end if;
      if new.taxonomy_id is distinct from old.taxonomy_id
        or new.method is distinct from old.method
        or new.model_name is distinct from old.model_name
        or new.prompt_version is distinct from old.prompt_version
        or new.started_at is distinct from old.started_at then
        raise exception 'classification run identity is immutable';
      end if;
      if new.status = 'running' then
        raise exception 'classification run update must be terminal';
      end if;
    end if;
    if tg_op = 'DELETE' then
      raise exception 'classification runs are append-only';
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name in (
    'general_question_item_classification_sets',
    'general_question_item_topics'
  ) then
    if tg_table_name = 'general_question_item_classification_sets' then
      select run.status into run_state
      from public.topic_classification_runs run
      where run.id = coalesce(
        new.classification_run_id, old.classification_run_id
      );
    else
      select run.status into run_state
      from public.topic_classification_runs run
      where run.id = (
        select classification_run_id
        from public.general_question_item_classification_sets
        where id = coalesce(new.classification_set_id, old.classification_set_id)
      );
    end if;
    if tg_table_name = 'general_question_item_topics'
      and run_state <> 'running' then
      raise exception 'terminal classification output is immutable';
    end if;
    if tg_table_name = 'general_question_item_classification_sets'
      and tg_op = 'INSERT' and run_state <> 'running' then
      raise exception 'classification sets must be created while run is running';
    end if;
    if tg_table_name = 'general_question_item_classification_sets'
      and tg_op = 'DELETE' and run_state <> 'running' then
      raise exception 'terminal classification output is immutable';
    end if;
    if tg_table_name = 'general_question_item_classification_sets' then
      if tg_op = 'UPDATE' and (
          new.question_item_revision_id
            is distinct from old.question_item_revision_id
          or new.classification_run_id
            is distinct from old.classification_run_id
          or new.taxonomy_id is distinct from old.taxonomy_id
        ) then
        raise exception 'classification set identity is immutable';
      end if;
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name in (
    'topic_classification_population_snapshots',
    'general_question_classification_population_members'
  ) then
    if tg_op <> 'INSERT' then
      raise exception 'classification population snapshots are immutable';
    end if;
    return new;
  end if;

  if tg_table_name = 'topic_classification_releases' then
    if tg_op = 'DELETE' and old.publication_state <> 'draft' then
      raise exception 'reviewed classification releases are append-only';
    end if;
    if tg_op = 'UPDATE' and old.publication_state <> 'draft' then
      if new.consumer_type is distinct from old.consumer_type
        or new.release_key is distinct from old.release_key
        or new.taxonomy_id is distinct from old.taxonomy_id
        or new.population_snapshot_id
          is distinct from old.population_snapshot_id
        or new.qa_status is distinct from old.qa_status
        or new.reviewed_by is distinct from old.reviewed_by
        or new.reviewed_at is distinct from old.reviewed_at
        or new.published_at is distinct from old.published_at then
        raise exception 'reviewed classification release is immutable';
      end if;
      if new.publication_state = 'draft' then
        raise exception 'classification release cannot return to draft';
      end if;
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'general_question_classification_release_items' then
    select publication_state into parent_state
    from public.topic_classification_releases
    where id = coalesce(new.release_id, old.release_id);
    if parent_state <> 'draft' then
      raise exception 'items of a reviewed classification release are immutable';
    end if;
    return coalesce(new, old);
  end if;

  return coalesce(new, old);
end;
$$;

create function validate_policy_classification_publication()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.policy_taxonomies taxonomy
    where taxonomy.publication_state in ('reviewed', 'published')
      and (
        taxonomy.qa_status <> 'verified'
        or taxonomy.reviewed_by is null
        or taxonomy.reviewed_at is null
        or taxonomy.content_hash is null
        or taxonomy.content_hash <> (
          select md5(coalesce(string_agg(
            topic.slug || ':' || topic.label || ':' || topic.description
              || ':' || topic.is_active::text || ':' || topic.display_order::text,
            '|' order by topic.display_order, topic.slug
          ), ''))
          from public.policy_topics topic
          where topic.taxonomy_id = taxonomy.id
        )
      )
  ) then
    raise exception 'reviewed taxonomy is incomplete or content hash differs';
  end if;

  if exists (
    select 1
    from public.general_question_item_classification_sets classification_set
    join public.topic_classification_runs run
      on run.id = classification_set.classification_run_id
    join public.policy_taxonomies taxonomy
      on taxonomy.id = classification_set.taxonomy_id
    join public.general_question_item_revisions item
      on item.id = classification_set.question_item_revision_id
    join public.general_question_appearance_revisions appearance
      on appearance.appearance_id = item.appearance_id
    where classification_set.publication_state = 'published'
      and (
        classification_set.qa_status <> 'verified'
        or classification_set.reviewed_by is null
        or classification_set.reviewed_at is null
        or run.status <> 'completed'
        or taxonomy.publication_state <> 'published'
        or taxonomy.qa_status <> 'verified'
        or item.publication_state <> 'published'
        or item.qa_status <> 'verified'
        or appearance.publication_state <> 'published'
        or appearance.qa_status <> 'verified'
      )
  ) then
    raise exception 'published classification set has ineligible dependencies';
  end if;

  if exists (
    select 1
    from public.topic_classification_releases release
    join public.policy_taxonomies taxonomy on taxonomy.id = release.taxonomy_id
    join public.topic_classification_population_snapshots snapshot
      on snapshot.id = release.population_snapshot_id
    where release.publication_state = 'published'
      and (
        release.consumer_type <> 'general_question_item'
        or release.qa_status <> 'verified'
        or release.reviewed_by is null
        or release.reviewed_at is null
        or taxonomy.publication_state <> 'published'
        or taxonomy.qa_status <> 'verified'
        or snapshot.consumer_type <> release.consumer_type
        or snapshot.cutoff_at > transaction_timestamp()
        or (
          select count(*)
          from public.general_question_classification_population_members member
          where member.snapshot_id = snapshot.id
        ) <> snapshot.subject_count
        or (
          select md5(coalesce(string_agg(
            member.question_item_revision_id::text,
            ',' order by member.ordinal
          ), ''))
          from public.general_question_classification_population_members member
          where member.snapshot_id = snapshot.id
        ) <> snapshot.ordered_subject_ids_hash
        or (
          select count(*)
          from public.general_question_classification_release_items item
          where item.release_id = release.id
        ) <> snapshot.subject_count
        or exists (
          select 1
          from public.general_question_classification_release_items item
          left join public.general_question_item_classification_sets classification_set
            on classification_set.id = item.classification_set_id
          left join public.topic_classification_runs run
            on run.id = classification_set.classification_run_id
          where item.release_id = release.id
            and (
              item.population_snapshot_id <> release.population_snapshot_id
              or item.taxonomy_id <> release.taxonomy_id
              or (item.coverage_disposition = 'classified' and (
                classification_set.question_item_revision_id
                  <> item.question_item_revision_id
                or classification_set.publication_state <> 'published'
                or classification_set.qa_status <> 'verified'
                or run.status <> 'completed'
              ))
              or (item.coverage_disposition <> 'classified' and (
                item.reviewed_by is null or item.reviewed_at is null
              ))
            )
        )
      )
  ) then
    raise exception 'published classification release is incomplete';
  end if;

  return null;
end;
$$;

create trigger policy_taxonomies_controlled_mutation
before update or delete on policy_taxonomies
for each row execute function enforce_policy_classification_invariants();
create trigger policy_topics_controlled_mutation
before insert or update or delete on policy_topics
for each row execute function enforce_policy_classification_invariants();
create trigger topic_classification_runs_controlled_mutation
before insert or update or delete on topic_classification_runs
for each row execute function enforce_policy_classification_invariants();
create trigger general_question_classification_sets_controlled_mutation
before insert or update or delete on general_question_item_classification_sets
for each row execute function enforce_policy_classification_invariants();
create trigger general_question_item_topics_controlled_mutation
before insert or update or delete on general_question_item_topics
for each row execute function enforce_policy_classification_invariants();
create trigger topic_classification_snapshots_controlled_mutation
before update or delete on topic_classification_population_snapshots
for each row execute function enforce_policy_classification_invariants();
create trigger general_question_population_members_controlled_mutation
before update or delete on general_question_classification_population_members
for each row execute function enforce_policy_classification_invariants();
create trigger topic_classification_releases_controlled_mutation
before update or delete on topic_classification_releases
for each row execute function enforce_policy_classification_invariants();
create trigger general_question_release_items_controlled_mutation
before insert or update or delete on general_question_classification_release_items
for each row execute function enforce_policy_classification_invariants();

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'policy_taxonomies',
    'policy_topics',
    'topic_classification_runs',
    'general_question_item_classification_sets',
    'general_question_item_topics',
    'topic_classification_population_snapshots',
    'general_question_classification_population_members',
    'topic_classification_releases',
    'general_question_classification_release_items'
  ] loop
    execute format(
      'create constraint trigger %I after insert or update or delete on %I
       deferrable initially deferred for each row
       execute function validate_policy_classification_publication()',
      target_table || '_publication_valid',
      target_table
    );
  end loop;
end;
$$;

revoke all on function enforce_policy_classification_invariants(),
  validate_policy_classification_publication()
from public, anon, authenticated, service_role;
