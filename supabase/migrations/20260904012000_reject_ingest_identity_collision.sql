-- 同じ会期・表示番号に別の永続identityが到着した場合、内容だけを上書きせず拒否する。
-- legacy writerのnull keyと、同一identityの再取り込みは従来どおり許可する。
create or replace function upsert_ingested_bill(
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
  existing_source_record_key text;
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
    document_url,
    source_record_key
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
    p_document_url,
    p_source_record_key
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
    document_url = excluded.document_url,
    source_record_key = coalesce(
      bills.source_record_key,
      excluded.source_record_key
    )
  where excluded.source_record_key is null
    or bills.source_record_key is null
    or bills.source_record_key = excluded.source_record_key
  returning id into bill_id;

  if bill_id is null then
    select source_record_key
    into existing_source_record_key
    from bills
    where council_session_id = p_council_session_id
      and bill_number = p_bill_number;

    raise exception using
      errcode = 'P0001',
      message = 'source_record_key mismatch for existing council session and bill number',
      detail = format(
        'council_session_id=%s, bill_number=%L, existing_source_record_key=%L, incoming_source_record_key=%L',
        p_council_session_id,
        p_bill_number,
        existing_source_record_key,
        p_source_record_key
      ),
      hint = 'ingest_identity_collision';
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
) is '取り込み議案を原子的にupsertし、異なる永続identityによる上書きを拒否する';

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
