-- 運営者が使う初版の政策分野と、人手分類・release公開の原子的操作。
insert into policy_taxonomies (id, version, label)
values (
  '10000000-0000-0000-0000-000000000001',
  'numazu-policy-v1',
  '沼津市政の政策分野 v1'
);
insert into policy_topics (
  id, taxonomy_id, slug, label, description, display_order
) values
  ('10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000001', 'disaster-safety', '防災・危機管理', '防災、消防、救急、防犯、交通安全', 10),
  ('10000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000001', 'children-education', '子育て・教育', '子育て支援、学校教育、生涯学習', 20),
  ('10000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-000000000001', 'health-welfare', '医療・福祉', '医療、健康、高齢者・障害者福祉', 30),
  ('10000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-000000000001', 'industry-tourism', '産業・観光', '商工業、農林水産業、雇用、観光', 40),
  ('10000000-0000-0000-0000-000000000105', '10000000-0000-0000-0000-000000000001', 'environment', '環境・脱炭素', '環境保全、廃棄物、脱炭素、エネルギー', 50),
  ('10000000-0000-0000-0000-000000000106', '10000000-0000-0000-0000-000000000001', 'urban-infrastructure', '都市・インフラ', '都市計画、道路、公園、上下水道、住宅', 60),
  ('10000000-0000-0000-0000-000000000107', '10000000-0000-0000-0000-000000000001', 'community-culture', '地域・文化・スポーツ', '地域自治、文化、スポーツ、多文化共生', 70),
  ('10000000-0000-0000-0000-000000000108', '10000000-0000-0000-0000-000000000001', 'digital-administration', 'デジタル・行政運営', '行政DX、組織、人材、情報公開', 80),
  ('10000000-0000-0000-0000-000000000109', '10000000-0000-0000-0000-000000000001', 'finance-assets', '財政・公共資産', '予算、財政運営、公共施設、資産活用', 90),
  ('10000000-0000-0000-0000-000000000110', '10000000-0000-0000-0000-000000000001', 'rights-participation', '人権・市民参加', '人権、男女共同参画、市民参加、選挙', 100);

create function classify_general_question_item_manually(
  p_question_item_revision_id uuid,
  p_policy_topic_ids uuid[],
  p_reviewed_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taxonomy_id constant uuid := '10000000-0000-0000-0000-000000000001';
  v_run_id uuid;
  v_set_id uuid;
  v_hash text;
begin
  if p_reviewed_by is null or cardinality(p_policy_topic_ids) < 1 then
    raise exception 'reviewer and at least one policy topic are required';
  end if;
  if exists (
    select 1 from unnest(p_policy_topic_ids) topic_id
    where not exists (
      select 1 from public.policy_topics topic
      where topic.id = topic_id and topic.taxonomy_id = v_taxonomy_id
        and topic.is_active
    )
  ) then raise exception 'policy topic does not belong to active taxonomy'; end if;
  if not exists (
    select 1 from public.general_question_item_revisions item
    where item.id = p_question_item_revision_id
      and item.qa_status = 'verified' and item.publication_state = 'published'
  ) then raise exception 'question item must be published and verified'; end if;

  if exists (
    select 1 from public.policy_taxonomies taxonomy
    where taxonomy.id = v_taxonomy_id and taxonomy.publication_state = 'draft'
  ) then
    select md5(coalesce(string_agg(
      topic.slug || ':' || topic.label || ':' || topic.description || ':'
        || topic.is_active::text || ':' || topic.display_order::text,
      '|' order by topic.display_order, topic.slug
    ), '')) into v_hash
    from public.policy_topics topic where topic.taxonomy_id = v_taxonomy_id;
    update public.policy_taxonomies
    set content_hash = v_hash, qa_status = 'verified',
      reviewed_by = p_reviewed_by, reviewed_at = now(),
      publication_state = 'published', published_at = now()
    where id = v_taxonomy_id;
  end if;

  insert into public.topic_classification_runs (
    taxonomy_id, method, model_name, prompt_version
  ) values (v_taxonomy_id, 'manual', null, 'manual-v1')
  returning id into v_run_id;
  insert into public.general_question_item_classification_sets (
    question_item_revision_id, classification_run_id, taxonomy_id
  ) values (p_question_item_revision_id, v_run_id, v_taxonomy_id)
  returning id into v_set_id;
  insert into public.general_question_item_topics (
    classification_set_id, taxonomy_id, policy_topic_id, confidence
  ) select v_set_id, v_taxonomy_id, topic_id, null
  from (select distinct unnest(p_policy_topic_ids) topic_id) topics;
  update public.topic_classification_runs
  set status = 'completed', finished_at = now() where id = v_run_id;
  update public.general_question_item_classification_sets
  set qa_status = 'verified', reviewed_by = p_reviewed_by, reviewed_at = now(),
    publication_state = 'reviewed'
  where id = v_set_id;
  return v_set_id;
end;
$$;

create function publish_general_question_classification_release(
  p_release_key text,
  p_reviewed_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taxonomy_id constant uuid := '10000000-0000-0000-0000-000000000001';
  v_snapshot_id uuid;
  v_release_id uuid;
begin
  if nullif(btrim(p_release_key), '') is null or p_reviewed_by is null then
    raise exception 'release key and reviewer are required';
  end if;
  v_snapshot_id := public.create_topic_classification_population_snapshot(
    'general_question_item', 'release:' || p_release_key,
    'date_range', 'published-items-v1', null, '2004-06-01', current_date,
    null
  );
  if exists (
    select 1
    from public.general_question_classification_population_members member
    where member.snapshot_id = v_snapshot_id and not exists (
      select 1 from public.general_question_item_classification_sets classification
      where classification.question_item_revision_id = member.question_item_revision_id
        and classification.taxonomy_id = v_taxonomy_id
        and classification.qa_status = 'verified'
        and classification.publication_state in ('reviewed', 'published')
    )
  ) then raise exception 'all snapshot items must be manually classified'; end if;

  update public.topic_classification_releases
  set publication_state = 'superseded'
  where consumer_type = 'general_question_item'
    and publication_state = 'published';
  update public.general_question_item_classification_sets current_set
  set publication_state = 'superseded'
  where current_set.publication_state = 'published'
    and exists (
      select 1
      from public.general_question_classification_population_members member
      where member.snapshot_id = v_snapshot_id
        and member.question_item_revision_id
          = current_set.question_item_revision_id
        and exists (
          select 1
          from public.general_question_item_classification_sets candidate
          where candidate.question_item_revision_id
              = current_set.question_item_revision_id
            and candidate.taxonomy_id = v_taxonomy_id
            and candidate.qa_status = 'verified'
            and candidate.publication_state = 'reviewed'
        )
    );
  update public.general_question_item_classification_sets candidate
  set publication_state = 'published'
  where candidate.taxonomy_id = v_taxonomy_id
    and candidate.qa_status = 'verified'
    and candidate.publication_state = 'reviewed'
    and exists (
      select 1
      from public.general_question_classification_population_members member
      where member.snapshot_id = v_snapshot_id
        and member.question_item_revision_id
          = candidate.question_item_revision_id
    )
    and not exists (
      select 1
      from public.general_question_item_classification_sets newer
      where newer.question_item_revision_id = candidate.question_item_revision_id
        and newer.taxonomy_id = candidate.taxonomy_id
        and newer.qa_status = 'verified'
        and newer.publication_state = 'reviewed'
        and newer.created_at > candidate.created_at
    );
  insert into public.topic_classification_releases (
    consumer_type, release_key, taxonomy_id, population_snapshot_id
  ) values (
    'general_question_item', p_release_key, v_taxonomy_id, v_snapshot_id
  ) returning id into v_release_id;
  insert into public.general_question_classification_release_items (
    release_id, population_snapshot_id, taxonomy_id,
    question_item_revision_id, classification_set_id, coverage_disposition
  )
  select v_release_id, v_snapshot_id, v_taxonomy_id,
    member.question_item_revision_id,
    (
      select classification.id
      from public.general_question_item_classification_sets classification
      where classification.question_item_revision_id = member.question_item_revision_id
        and classification.taxonomy_id = v_taxonomy_id
        and classification.qa_status = 'verified'
        and classification.publication_state = 'published'
      order by classification.created_at desc limit 1
    ), 'classified'
  from public.general_question_classification_population_members member
  where member.snapshot_id = v_snapshot_id;
  update public.topic_classification_releases
  set qa_status = 'verified', reviewed_by = p_reviewed_by,
    reviewed_at = now(), publication_state = 'published', published_at = now()
  where id = v_release_id;
  return v_release_id;
end;
$$;

revoke all on function classify_general_question_item_manually(uuid, uuid[], uuid),
  publish_general_question_classification_release(text, uuid)
from public, anon, authenticated;
grant execute on function classify_general_question_item_manually(uuid, uuid[], uuid),
  publish_general_question_classification_release(text, uuid)
to service_role;
