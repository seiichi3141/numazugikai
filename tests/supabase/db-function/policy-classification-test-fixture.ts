import {
  generalQuestionAppearanceFixtureSql,
  publishGeneralQuestionAppearanceSql,
} from "./general-question-test-fixture";

export const publishedGeneralQuestionItemFixtureSql = `
  ${generalQuestionAppearanceFixtureSql}
  ${publishGeneralQuestionAppearanceSql}
  insert into public.general_question_items (
    id, appearance_id, item_key
  ) values (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    'item-1'
  );
  insert into public.general_question_item_revisions (
    id, question_item_id, appearance_id, revision_number, item_order,
    public_summary
  ) values (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    1, 1, '防災対策について'
  );
  insert into public.general_question_item_source_occurrences (
    id, question_item_id, appearance_id, appearance_source_occurrence_id,
    source_item_key
  ) values (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000203',
    'item-1'
  );
  insert into public.general_question_item_sources (
    id, item_source_occurrence_id, appearance_source_occurrence_id,
    question_item_revision_id, question_item_id, appearance_id,
    appearance_source_id, source_locator, observed_label, qa_status,
    verified_by, verified_at
  ) values (
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000204',
    'page=1;item=1', '防災対策について', 'verified',
    '00000000-0000-0000-0000-000000000109', now()
  );
  update public.general_question_item_revisions
  set qa_status = 'verified',
      reviewed_by = '00000000-0000-0000-0000-000000000109',
      reviewed_at = now()
  where id = '00000000-0000-0000-0000-000000000302';
  update public.general_question_item_revisions
  set publication_state = 'reviewed'
  where id = '00000000-0000-0000-0000-000000000302';
  update public.general_question_item_revisions
  set publication_state = 'published'
  where id = '00000000-0000-0000-0000-000000000302';
`;

export const publishedTaxonomyFixtureSql = `
  insert into public.policy_taxonomies (
    id, version, label
  ) values (
    '00000000-0000-0000-0000-000000000401', 'v1', '政策分野 v1'
  );
  insert into public.policy_topics (
    id, taxonomy_id, slug, label, description, display_order
  ) values (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000401',
    'disaster-prevention', '防災', '防災と危機管理', 1
  );
  update public.policy_taxonomies taxonomy
  set qa_status = 'verified',
      publication_state = 'published',
      reviewed_by = '00000000-0000-0000-0000-000000000109',
      reviewed_at = now(),
      published_at = now(),
      content_hash = (
        select md5(string_agg(
          topic.slug || ':' || topic.label || ':' || topic.description
            || ':' || topic.is_active::text || ':' || topic.display_order::text,
          '|' order by topic.display_order, topic.slug
        ))
        from public.policy_topics topic
        where topic.taxonomy_id = taxonomy.id
      )
  where taxonomy.id = '00000000-0000-0000-0000-000000000401';
`;

export const publishedClassificationSetFixtureSql = `
  ${publishedGeneralQuestionItemFixtureSql}
  ${publishedTaxonomyFixtureSql}
  insert into public.topic_classification_runs (
    id, taxonomy_id, method
  ) values (
    '00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000401',
    'manual'
  );
  insert into public.general_question_item_classification_sets (
    id, question_item_revision_id, classification_run_id, taxonomy_id
  ) values (
    '00000000-0000-0000-0000-000000000404',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000401'
  );
  insert into public.general_question_item_topics (
    classification_set_id, taxonomy_id, policy_topic_id
  ) values (
    '00000000-0000-0000-0000-000000000404',
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000402'
  );
  update public.topic_classification_runs
  set status = 'completed', finished_at = now()
  where id = '00000000-0000-0000-0000-000000000403';
  update public.general_question_item_classification_sets
  set qa_status = 'verified',
      publication_state = 'published',
      reviewed_by = '00000000-0000-0000-0000-000000000109',
      reviewed_at = now()
  where id = '00000000-0000-0000-0000-000000000404';
`;
