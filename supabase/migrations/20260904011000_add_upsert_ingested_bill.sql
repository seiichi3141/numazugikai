-- 既存の会期・議案番号でupsertしつつ、永続keyは初回確定後に変更しない。
-- 2つの書き込みを同じtransactionで行い、UNIQUE衝突時の部分書き込みを防ぐ。
create function upsert_ingested_bill(
  p_council_session_id uuid,
  p_bill_number text,
  p_number_kind bill_number_kind_enum,
  p_number_value integer,
  p_name text,
  p_category bill_category_enum,
  p_status bill_status_enum,
  p_source_url text,
  p_source_record_key text default null,
  p_legal_basis text default null,
  p_submitted_on date default null,
  p_submitter bill_submitter_enum default null,
  p_committee_id uuid default null,
  p_committee_result text default null,
  p_decided_on date default null,
  p_status_note text default null,
  p_document_url text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $function$
declare
  bill_id uuid;
begin
  insert into bills (
    council_session_id,
    bill_number,
    bill_number_kind,
    bill_number_value,
    name,
    category,
    legal_basis,
    submitted_date,
    submitter,
    committee_id,
    committee_result,
    decided_on,
    status,
    status_note,
    source_url,
    document_url
  ) values (
    p_council_session_id,
    p_bill_number,
    p_number_kind,
    p_number_value,
    p_name,
    p_category,
    p_legal_basis,
    p_submitted_on,
    p_submitter,
    p_committee_id,
    p_committee_result,
    p_decided_on,
    p_status,
    p_status_note,
    p_source_url,
    p_document_url
  )
  on conflict (council_session_id, bill_number)
  do update set
    bill_number_kind = excluded.bill_number_kind,
    bill_number_value = excluded.bill_number_value,
    name = excluded.name,
    category = excluded.category,
    legal_basis = excluded.legal_basis,
    submitted_date = excluded.submitted_date,
    submitter = excluded.submitter,
    committee_id = excluded.committee_id,
    committee_result = excluded.committee_result,
    decided_on = excluded.decided_on,
    status = excluded.status,
    status_note = excluded.status_note,
    source_url = excluded.source_url,
    document_url = excluded.document_url
  returning id into bill_id;

  if p_source_record_key is not null then
    update bills
    set source_record_key = p_source_record_key
    where id = bill_id
      and source_record_key is null;
  end if;

  return bill_id;
end;
$function$;

comment on function upsert_ingested_bill(
  uuid,
  text,
  bill_number_kind_enum,
  integer,
  text,
  bill_category_enum,
  bill_status_enum,
  text,
  text,
  text,
  date,
  bill_submitter_enum,
  uuid,
  text,
  date,
  text,
  text
) is '取り込み議案を原子的にupsertし、source_record_keyをwrite-onceで設定する';

revoke execute on function upsert_ingested_bill(
  uuid, text, bill_number_kind_enum, integer, text, bill_category_enum,
  bill_status_enum, text, text, text, date, bill_submitter_enum, uuid,
  text, date, text, text
) from public, anon, authenticated;

grant execute on function upsert_ingested_bill(
  uuid, text, bill_number_kind_enum, integer, text, bill_category_enum,
  bill_status_enum, text, text, text, date, bill_submitter_enum, uuid,
  text, date, text, text
) to service_role;
