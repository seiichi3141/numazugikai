-- Filter and paginate the public general-question collection before hydration.

create function public.list_published_general_question_appearances(
  p_limit integer default 51,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_session_slug text default null,
  p_year integer default null,
  p_question_kind text default null,
  p_topic_slug text default null,
  p_role_group text default null
)
returns table (
  appearance_id uuid,
  cursor_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select appearance.appearance_id, ordering.cursor_at
  from general_question_appearance_revisions appearance
  join council_meeting_revisions meeting
    on meeting.meeting_id = appearance.meeting_id
   and meeting.qa_status = 'verified'
   and meeting.publication_state = 'published'
   and meeting.kind = 'plenary'
   and meeting.status in ('scheduled', 'held')
  join council_sessions session
    on session.id = meeting.council_session_id
   and session.slug is not null
  cross join lateral (
    select
      case
        when appearance.question_order is null then
          coalesce(meeting.held_on, meeting.scheduled_on, session.start_date)::timestamptz
        else
          coalesce(meeting.held_on, meeting.scheduled_on, session.start_date)::timestamp
          + interval '23 hours 59 minutes 59 seconds'
          + (
              999999 - least(greatest(appearance.question_order, 1), 999998)
            ) * interval '1 microsecond'
      end as cursor_at
  ) ordering
  where appearance.qa_status = 'verified'
    and appearance.publication_state = 'published'
    and (p_session_slug is null or session.slug = p_session_slug)
    and (
      p_year is null
      or extract(year from coalesce(
        meeting.held_on, meeting.scheduled_on, session.start_date
      ))::integer = p_year
    )
    and (
      p_question_kind is null
      or appearance.question_kind::text = p_question_kind
    )
    and (
      p_topic_slug is null
      or exists (
        select 1
        from general_question_item_revisions item
        join general_question_classification_release_items release_item
          on release_item.question_item_revision_id = item.id
         and release_item.coverage_disposition = 'classified'
        join topic_classification_releases release
          on release.id = release_item.release_id
         and release.consumer_type = 'general_question_item'
         and release.qa_status = 'verified'
         and release.publication_state = 'published'
        join general_question_item_topics item_topic
          on item_topic.classification_set_id = release_item.classification_set_id
        join policy_topics topic
          on topic.id = item_topic.policy_topic_id
        where item.appearance_id = appearance.appearance_id
          and item.qa_status = 'verified'
          and item.publication_state = 'published'
          and topic.slug = p_topic_slug
      )
    )
    and (
      p_role_group is null
      or exists (
        select 1
        from general_question_answerer_revisions answerer
        where answerer.appearance_id = appearance.appearance_id
          and answerer.qa_status = 'verified'
          and answerer.publication_state = 'published'
          and answerer.role_group::text = p_role_group
      )
    )
    and (
      p_cursor_at is null
      or ordering.cursor_at < p_cursor_at
      or (
        ordering.cursor_at = p_cursor_at
        and p_cursor_id is not null
        and appearance.appearance_id < p_cursor_id
      )
    )
  order by ordering.cursor_at desc, appearance.appearance_id desc
  limit least(greatest(p_limit, 1), 101);
$$;

revoke all on function public.list_published_general_question_appearances(
  integer, timestamptz, uuid, text, integer, text, text, text
) from public, anon, authenticated;
grant execute on function public.list_published_general_question_appearances(
  integer, timestamptz, uuid, text, integer, text, text, text
) to service_role;
