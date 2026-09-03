-- QA済みparser出力を、根拠付きの追記型正本へ原子的に反映する。
create table general_question_staging_applications (
  id uuid primary key default gen_random_uuid(),
  staging_id uuid not null unique references general_question_staging_appearances(id)
    on delete restrict,
  appearance_id uuid not null references general_question_appearances(id)
    on delete restrict,
  applied_by uuid not null,
  applied_at timestamptz not null default now()
);
alter table general_question_staging_applications enable row level security;
revoke update, delete, truncate on general_question_staging_applications
from anon, authenticated, service_role;

create function apply_verified_general_question_staging(
  p_staging_id uuid,
  p_reviewed_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
<<apply>>
declare
  staged public.general_question_staging_appearances%rowtype;
  batch public.general_question_import_batches%rowtype;
  source_version public.ingestion_source_versions%rowtype;
  ingestion_source public.ingestion_sources%rowtype;
  evidence_method public.extraction_method_enum;
  evidence_parse_run_id uuid;
  source_system text;
  payload jsonb;
  held_on date;
  meeting_id uuid;
  meeting_revision_id uuid;
  meeting_occurrence_id uuid;
  appearance_id uuid;
  appearance_revision_id uuid;
  appearance_occurrence_id uuid;
  appearance_source_id uuid;
  item jsonb;
  answerer text;
  question_item_id uuid;
  question_item_revision_id uuid;
  parent_item_id uuid;
  item_occurrence_id uuid;
  answerer_id uuid;
  answerer_revision_id uuid;
  answerer_occurrence_id uuid;
  revision_number integer;
  item_index integer := 0;
  answerer_index integer := 0;
begin
  if p_reviewed_by is null then
    raise exception 'reviewer is required';
  end if;
  select application.appearance_id into appearance_id
  from public.general_question_staging_applications application
  where application.staging_id = p_staging_id;
  if found then return appearance_id; end if;
  select * into staged
  from public.general_question_staging_appearances
  where id = p_staging_id
  for update;
  if not found or staged.qa_status <> 'verified' then
    raise exception 'staging row must be verified before apply';
  end if;
  select * into batch
  from public.general_question_import_batches
  where id = staged.batch_id
  for update;
  if batch.status not in ('awaiting_review', 'approved') then
    raise exception 'import batch is not ready to apply';
  end if;
  if batch.council_session_id is null then
    raise exception 'council session must be matched before apply';
  end if;
  select * into source_version
  from public.ingestion_source_versions
  where id = batch.source_version_id;
  if not found then raise exception 'source version is required'; end if;
  select * into ingestion_source from public.ingestion_sources
  where id = source_version.ingestion_source_id;
  if ingestion_source.source = 'general_question_pdf' then
    if source_version.artifact_retention_state <> 'retained' then
      raise exception 'retained source artifact is required';
    end if;
    evidence_method := 'parser';
    evidence_parse_run_id := batch.parse_run_id;
    source_system := 'numazu_general_question_pdf';
  elsif ingestion_source.source = 'general_question_record' then
    if source_version.artifact_retention_state <> 'not_permitted' then
      raise exception 'meeting record body must not be retained';
    end if;
    evidence_method := 'manual';
    evidence_parse_run_id := null;
    source_system := 'numazu_amivoice';
  else
    raise exception 'unsupported general question source';
  end if;

  -- 消滅候補は既存公開値を自動で取り下げず、QA記録だけを残す。
  if staged.change_kind = 'missing' then
    raise exception 'missing staging row must not remove published data automatically';
  end if;
  if staged.change_kind = 'ambiguous' then
    raise exception 'ambiguous staging row cannot be applied';
  end if;

  payload := staged.parsed_payload;
  held_on := coalesce(
    staged.reviewed_held_on,
    nullif(payload ->> 'heldOn', '')::date
  );
  if held_on is null then
    raise exception 'held date is required before apply';
  end if;

  appearance_id := coalesce(
    staged.reviewed_matched_appearance_id,
    staged.matched_appearance_id
  );
  if appearance_id is not null then
    select appearance.meeting_id into meeting_id
    from public.general_question_appearances appearance
    where appearance.id = apply.appearance_id;
    if not exists (
      select 1 from public.council_meeting_revisions revision
      where revision.meeting_id = apply.meeting_id
        and revision.council_session_id = batch.council_session_id
        and revision.held_on = apply.held_on
        and revision.qa_status = 'verified'
        and revision.publication_state = 'published'
    ) then
      raise exception 'reviewed appearance match must belong to the same published meeting date';
    end if;
  end if;

  if meeting_id is null then
    select occurrence.meeting_id, occurrence.id
    into meeting_id, meeting_occurrence_id
    from public.council_meeting_source_occurrences occurrence
    where occurrence.ingestion_source_id = source_version.ingestion_source_id
      and occurrence.source_occurrence_key = 'meeting:' || held_on::text;
  else
    select occurrence.id into meeting_occurrence_id
    from public.council_meeting_source_occurrences occurrence
    where occurrence.meeting_id = apply.meeting_id
      and occurrence.ingestion_source_id = source_version.ingestion_source_id
      and occurrence.source_occurrence_key = 'meeting:' || held_on::text;
  end if;

  if meeting_id is null then
    insert into public.council_meetings (canonical_meeting_key)
    values ('general-question:' || gen_random_uuid()::text)
    returning id into meeting_id;
    insert into public.council_meeting_source_occurrences (
      meeting_id, ingestion_source_id, source_occurrence_key, source_system
    ) values (
      meeting_id, source_version.ingestion_source_id,
      'meeting:' || held_on::text, source_system
    ) returning id into meeting_occurrence_id;
  elsif meeting_occurrence_id is null then
    insert into public.council_meeting_source_occurrences (
      meeting_id, ingestion_source_id, source_occurrence_key, source_system
    ) values (
      meeting_id, source_version.ingestion_source_id,
      'meeting:' || held_on::text, source_system
    ) returning id into meeting_occurrence_id;
  end if;

  select revision.id into meeting_revision_id
  from public.council_meeting_revisions revision
  where revision.meeting_id = apply.meeting_id
    and revision.publication_state = 'published';
  if meeting_revision_id is null then
    select coalesce(max(revision.revision_number), 0) + 1 into revision_number
    from public.council_meeting_revisions revision
    where revision.meeting_id = apply.meeting_id;
    insert into public.council_meeting_revisions (
      meeting_id, revision_number, council_session_id, kind, held_on,
      display_title, status, source_support_status
    )
    select meeting_id, revision_number, session.id, 'plenary', held_on,
      session.name || ' 本会議（一般質問）', 'held', 'official_supported'
    from public.council_sessions session
    where session.id = batch.council_session_id
    returning id into meeting_revision_id;
    insert into public.council_meeting_source_evidence (
      revision_id, meeting_source_occurrence_id, source_version_id,
      parse_run_id, meeting_id, ingestion_source_id, role,
      source_evidence_key, locator, qa_status, extraction_method,
      verified_by, verified_at, observed_title, observed_held_on,
      observed_status
    )
    select meeting_revision_id, meeting_occurrence_id, batch.source_version_id,
      evidence_parse_run_id, meeting_id, source_version.ingestion_source_id,
      'record', 'meeting:' || held_on::text, 'date=' || held_on::text,
      'verified', evidence_method, p_reviewed_by, now(),
      session.name || ' 本会議（一般質問）', held_on, 'held'
    from public.council_sessions session
    where session.id = batch.council_session_id;
    update public.council_meeting_revisions
    set qa_status = 'verified', reviewed_by = p_reviewed_by, reviewed_at = now()
    where id = meeting_revision_id;
    update public.council_meeting_revisions set publication_state = 'reviewed'
    where id = meeting_revision_id;
    update public.council_meeting_revisions set publication_state = 'published'
    where id = meeting_revision_id;
  end if;

  -- 別資料を既存会議へ人手で突合した場合も、その資料固有の根拠を追記する。
  insert into public.council_meeting_source_evidence (
    revision_id, meeting_source_occurrence_id, source_version_id,
    parse_run_id, meeting_id, ingestion_source_id, role,
    source_evidence_key, locator, qa_status, extraction_method,
    verified_by, verified_at, observed_title, observed_held_on,
    observed_status
  )
  select revision.id, meeting_occurrence_id, batch.source_version_id,
    evidence_parse_run_id, apply.meeting_id, source_version.ingestion_source_id,
    'record', 'meeting:' || apply.held_on::text,
    'date=' || apply.held_on::text,
    'verified', evidence_method, p_reviewed_by, now(),
    revision.display_title, apply.held_on, revision.status
  from public.council_meeting_revisions revision
  where revision.id = meeting_revision_id
  on conflict do nothing;

  if appearance_id is null then
    select id into appearance_id
    from public.general_question_appearances
    where general_question_appearances.meeting_id = apply.meeting_id
      and general_question_appearances.appearance_key = staged.source_appearance_key;
  end if;
  if appearance_id is null then
    insert into public.general_question_appearances (
      meeting_id, appearance_key
    ) values (meeting_id, staged.source_appearance_key)
    returning id into appearance_id;
  end if;

  insert into public.general_question_appearance_source_occurrences (
    appearance_id, meeting_id, meeting_source_occurrence_id,
    ingestion_source_id, source_appearance_key
  ) values (
    appearance_id, meeting_id, meeting_occurrence_id,
    source_version.ingestion_source_id, staged.source_appearance_key
  )
  on conflict (meeting_source_occurrence_id, source_appearance_key)
  do update set source_appearance_key = excluded.source_appearance_key
  returning id into appearance_occurrence_id;

  -- PDF正本へ会議記録を突合した場合は、完全性の低い会議記録で内容を置換せず
  -- 既存の公開revisionへ補足根拠だけを追加する。
  if ingestion_source.source = 'general_question_record'
    and staged.reviewed_matched_appearance_id is not null then
    select revision.id into appearance_revision_id
    from public.general_question_appearance_revisions revision
    where revision.appearance_id = apply.appearance_id
      and revision.qa_status = 'verified'
      and revision.publication_state = 'published';
    if appearance_revision_id is null then
      raise exception 'reviewed appearance match requires a published revision';
    end if;
    insert into public.general_question_appearance_sources (
      appearance_source_occurrence_id, appearance_revision_id, appearance_id,
      meeting_id, ingestion_source_id, source_version_id, parse_run_id,
      source_locator, role, extraction_method, observed_speaker_name,
      observed_seat_number, observed_question_order, observed_question_kind,
      observed_delivery_method, qa_status, verified_by, verified_at
    ) values (
      appearance_occurrence_id, appearance_revision_id, appearance_id,
      meeting_id, source_version.ingestion_source_id, batch.source_version_id,
      null, 'appearance=' || staged.source_appearance_key, 'supplementary',
      'manual', payload ->> 'speakerName',
      nullif(payload ->> 'seatNumber', '')::integer,
      nullif(payload ->> 'questionOrder', '')::integer,
      coalesce(nullif(payload ->> 'questionKind', ''), 'unknown')::public.general_question_kind_enum,
      coalesce(nullif(payload ->> 'deliveryMethod', ''), 'unknown')::public.general_question_delivery_method_enum,
      'verified', p_reviewed_by, now()
    );
    insert into public.general_question_staging_applications (
      staging_id, appearance_id, applied_by
    ) values (p_staging_id, appearance_id, p_reviewed_by);
    if not exists (
      select 1 from public.general_question_staging_appearances remaining
      where remaining.batch_id = batch.id and remaining.qa_status = 'pending'
    ) then
      update public.general_question_import_batches set status = 'approved'
      where id = batch.id and status = 'awaiting_review';
      update public.general_question_import_batches set status = 'applied'
      where id = batch.id and status = 'approved';
    end if;
    return appearance_id;
  end if;

  -- 訂正版を公開する前に、旧分類releaseと旧revisionを履歴へ退避する。
  update public.topic_classification_releases release
  set publication_state = 'superseded'
  where release.consumer_type = 'general_question_item'
    and release.publication_state = 'published'
    and exists (
      select 1
      from public.general_question_classification_release_items release_item
      join public.general_question_item_revisions old_item
        on old_item.id = release_item.question_item_revision_id
      where release_item.release_id = release.id
        and old_item.appearance_id = apply.appearance_id
    );
  update public.general_question_item_classification_sets classification_set
  set publication_state = 'superseded'
  where classification_set.publication_state = 'published'
    and exists (
      select 1 from public.general_question_item_revisions old_item
      where old_item.id = classification_set.question_item_revision_id
        and old_item.appearance_id = apply.appearance_id
    );
  update public.general_question_item_revisions
  set publication_state = 'superseded'
  where general_question_item_revisions.appearance_id = apply.appearance_id
    and publication_state = 'published';
  update public.general_question_answerer_revisions
  set publication_state = 'superseded'
  where general_question_answerer_revisions.appearance_id = apply.appearance_id
    and publication_state = 'published';
  update public.general_question_appearance_revisions
  set publication_state = 'superseded'
  where general_question_appearance_revisions.appearance_id = apply.appearance_id
    and publication_state = 'published';

  select coalesce(max(revision.revision_number), 0) + 1 into revision_number
  from public.general_question_appearance_revisions revision
  where revision.appearance_id = apply.appearance_id;
  insert into public.general_question_appearance_revisions (
    appearance_id, meeting_id, revision_number, speaker_display_name,
    seat_number, question_order, question_kind, delivery_method
  ) values (
    appearance_id, meeting_id, revision_number, payload ->> 'speakerName',
    nullif(payload ->> 'seatNumber', '')::integer,
    nullif(payload ->> 'questionOrder', '')::integer,
    coalesce(nullif(payload ->> 'questionKind', ''), 'unknown')::public.general_question_kind_enum,
    coalesce(nullif(payload ->> 'deliveryMethod', ''), 'unknown')::public.general_question_delivery_method_enum
  ) returning id into appearance_revision_id;
  insert into public.general_question_appearance_sources (
    appearance_source_occurrence_id, appearance_revision_id, appearance_id,
    meeting_id, ingestion_source_id, source_version_id, parse_run_id,
    source_locator, role, extraction_method, observed_speaker_name,
    observed_seat_number, observed_question_order, observed_question_kind,
    observed_delivery_method, qa_status, verified_by, verified_at
  ) values (
    appearance_occurrence_id, appearance_revision_id, appearance_id,
    meeting_id, source_version.ingestion_source_id, batch.source_version_id,
    evidence_parse_run_id, 'appearance=' || staged.source_appearance_key,
    'primary', evidence_method, payload ->> 'speakerName',
    nullif(payload ->> 'seatNumber', '')::integer,
    nullif(payload ->> 'questionOrder', '')::integer,
    coalesce(nullif(payload ->> 'questionKind', ''), 'unknown')::public.general_question_kind_enum,
    coalesce(nullif(payload ->> 'deliveryMethod', ''), 'unknown')::public.general_question_delivery_method_enum,
    'verified', p_reviewed_by, now()
  ) returning id into appearance_source_id;

  -- 安定項目を先に全て作り、親IDを解決できる状態にする。
  for item in select value from jsonb_array_elements(coalesce(payload -> 'items', '[]')) loop
    insert into public.general_question_items (appearance_id, item_key)
    values (appearance_id, item ->> 'sourceKey')
    on conflict on constraint general_question_items_appearance_id_item_key_key
    do nothing;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(payload -> 'items', '[]')) loop
    item_index := item_index + 1;
    select id into question_item_id from public.general_question_items
    where general_question_items.appearance_id = apply.appearance_id
      and general_question_items.item_key = item ->> 'sourceKey';
    parent_item_id := null;
    if nullif(item ->> 'parentSourceKey', '') is not null then
      select id into parent_item_id from public.general_question_items
      where general_question_items.appearance_id = apply.appearance_id
        and general_question_items.item_key = item ->> 'parentSourceKey';
    end if;
    select coalesce(max(revision.revision_number), 0) + 1 into revision_number
    from public.general_question_item_revisions revision
    where revision.question_item_id = apply.question_item_id;
    insert into public.general_question_item_revisions (
      question_item_id, appearance_id, revision_number, parent_item_id,
      item_order, public_summary
    ) values (
      question_item_id, appearance_id, revision_number, parent_item_id,
      coalesce(nullif(item ->> 'order', '')::integer, item_index), item ->> 'label'
    ) returning id into question_item_revision_id;
    insert into public.general_question_item_source_occurrences (
      question_item_id, appearance_id, appearance_source_occurrence_id,
      source_item_key
    ) values (
      question_item_id, appearance_id, appearance_occurrence_id,
      item ->> 'sourceKey'
    ) on conflict (appearance_source_occurrence_id, source_item_key)
      do update set source_item_key = excluded.source_item_key
    returning id into item_occurrence_id;
    insert into public.general_question_item_sources (
      item_source_occurrence_id, appearance_source_occurrence_id,
      question_item_revision_id, question_item_id, appearance_id,
      appearance_source_id, source_locator, observed_label, qa_status,
      verified_by, verified_at
    ) values (
      item_occurrence_id, appearance_occurrence_id, question_item_revision_id,
      question_item_id, appearance_id, appearance_source_id,
      'appearance=' || staged.source_appearance_key || ';item=' || (item ->> 'sourceKey'),
      item ->> 'label', 'verified', p_reviewed_by, now()
    );
    update public.general_question_item_revisions
    set qa_status = 'verified', reviewed_by = p_reviewed_by, reviewed_at = now()
    where id = question_item_revision_id;
    update public.general_question_item_revisions set publication_state = 'reviewed'
    where id = question_item_revision_id;
    update public.general_question_item_revisions set publication_state = 'published'
    where id = question_item_revision_id;
  end loop;

  for answerer in select value #>> '{}' from jsonb_array_elements(coalesce(payload -> 'answerers', '[]')) loop
    answerer_index := answerer_index + 1;
    insert into public.general_question_answerers (appearance_id, answerer_key)
    values (appearance_id, 'answerer-' || answerer_index)
    on conflict on constraint general_question_answerers_appearance_id_answerer_key_key
    do update
      set answerer_key = excluded.answerer_key
    returning id into answerer_id;
    select coalesce(max(revision.revision_number), 0) + 1 into revision_number
    from public.general_question_answerer_revisions revision
    where revision.answerer_id = apply.answerer_id;
    insert into public.general_question_answerer_revisions (
      answerer_id, appearance_id, revision_number, person_display_name,
      role_display_name, role_group, display_order
    ) values (
      answerer_id, appearance_id, revision_number, answerer, answerer,
      case
        when answerer like '%副市長%' then 'deputy_mayor'
        when answerer like '%市長%' then 'mayor'
        when answerer like '%教育長%' then 'superintendent'
        when answerer ~ '(部長|局長|病院長)$' then 'department_head'
        when answerer ~ '(課長|室長)$' then 'division_head'
        when answerer ~ '(委員長|代表監査委員|企業管理者)$' then 'administration_other'
        else 'unknown'
      end::public.general_question_role_group_enum,
      answerer_index
    ) returning id into answerer_revision_id;
    insert into public.general_question_answerer_source_occurrences (
      answerer_id, appearance_id, appearance_source_occurrence_id,
      source_answerer_key
    ) values (
      answerer_id, appearance_id, appearance_occurrence_id,
      'answerer-' || answerer_index
    ) on conflict (appearance_source_occurrence_id, source_answerer_key)
      do update set source_answerer_key = excluded.source_answerer_key
    returning id into answerer_occurrence_id;
    insert into public.general_question_answerer_sources (
      answerer_source_occurrence_id, appearance_source_occurrence_id,
      answerer_revision_id, answerer_id, appearance_id, appearance_source_id,
      source_locator, observed_role_name, qa_status, verified_by, verified_at
    ) values (
      answerer_occurrence_id, appearance_occurrence_id, answerer_revision_id,
      answerer_id, appearance_id, appearance_source_id,
      'appearance=' || staged.source_appearance_key || ';answerer=' || answerer_index,
      answerer, 'verified', p_reviewed_by, now()
    );
    update public.general_question_answerer_revisions
    set qa_status = 'verified', reviewed_by = p_reviewed_by, reviewed_at = now()
    where id = answerer_revision_id;
    update public.general_question_answerer_revisions set publication_state = 'reviewed'
    where id = answerer_revision_id;
    update public.general_question_answerer_revisions set publication_state = 'published'
    where id = answerer_revision_id;
  end loop;

  update public.general_question_appearance_revisions
  set qa_status = 'verified', reviewed_by = p_reviewed_by, reviewed_at = now()
  where id = appearance_revision_id;

  insert into public.general_question_staging_applications (
    staging_id, appearance_id, applied_by
  ) values (p_staging_id, appearance_id, p_reviewed_by);
  update public.general_question_appearance_revisions set publication_state = 'reviewed'
  where id = appearance_revision_id;
  update public.general_question_appearance_revisions
  set publication_state = 'published', published_at = now()
  where id = appearance_revision_id;

  if not exists (
    select 1 from public.general_question_staging_appearances remaining
    where remaining.batch_id = batch.id and remaining.qa_status = 'pending'
  ) then
    update public.general_question_import_batches set status = 'approved'
    where id = batch.id and status = 'awaiting_review';
    update public.general_question_import_batches set status = 'applied'
    where id = batch.id and status = 'approved';
  end if;
  return appearance_id;
end;
$$;

revoke all on function apply_verified_general_question_staging(uuid, uuid)
from public, anon, authenticated;
grant execute on function apply_verified_general_question_staging(uuid, uuid)
to service_role;
