-- 自治体をまたいで議案を一意に識別するkeyを、既存制約を残したまま追加する。
-- NULLは手入力・未移行recordで許容し、自動取り込みrecordだけを段階的に移行する。

alter table bills
  add column source_record_key text;

comment on column bills.source_record_key is
  '自治体・会期・文書区分・提出区分・source上の番号から成る取り込み用永続key';

-- partial unique indexはPostgRESTのON CONFLICT推論に使わず、通常のUNIQUE制約にする。
-- PostgreSQLではNULL同士は競合しないため、未移行recordを壊さない。
alter table bills
  add constraint bills_source_record_key_key unique (source_record_key);

-- 沼津公式の議案結果ページから取り込まれ、識別に必要な値が揃う既存行だけをbackfillする。
-- number kindをnormalized numberへ残し、同じ数値の「議第」「認第」等を区別する。
create function pg_temp.build_numazu_bill_source_record_key(
  input_session_slug text,
  input_number_kind bill_number_kind_enum,
  input_number_value integer,
  input_submitter bill_submitter_enum
)
returns text
language sql
immutable
as $function$
  select case
    when input_session_slug is null
      or input_number_kind is null
      or input_number_value is null
      or input_session_slug !~ '^[0-9]{4}-[0-9]+$'
      or input_number_value < 0
      or (
        input_submitter is null
        and input_number_kind not in ('hatsugi', 'seigan', 'chinjo')
      )
      then null
    else concat(
      'numazu-city:',
      input_session_slug,
      ':',
      case
        when input_number_kind = 'hou' then 'report'
        when input_number_kind in ('seigan', 'chinjo') then 'petition'
        when input_submitter = 'committee' then 'committee_bill'
        when input_number_kind = 'hatsugi' or input_submitter = 'member'
          then 'member_bill'
        else 'executive_bill'
      end,
      ':',
      case
        when input_submitter is not null then input_submitter::text
        when input_number_kind = 'hatsugi' then 'member'
        when input_number_kind in ('seigan', 'chinjo') then 'citizen'
      end,
      ':numbered:',
      input_number_kind::text,
      '-',
      input_number_value::text
    )
  end;
$function$;

-- data migration自体で代表的な写像とfail-closed条件を検算する。
do $$
begin
  if pg_temp.build_numazu_bill_source_record_key(
    '2026-13', 'gi', 58, 'mayor'
  ) is distinct from
    'numazu-city:2026-13:executive_bill:mayor:numbered:gi-58'
  then
    raise exception 'Numazu source_record_key mapping check failed for gi';
  end if;

  if pg_temp.build_numazu_bill_source_record_key(
    '2026-13', 'hatsugi', 1, 'committee'
  ) is distinct from
    'numazu-city:2026-13:committee_bill:committee:numbered:hatsugi-1'
  then
    raise exception 'Numazu source_record_key mapping check failed for committee';
  end if;

  if pg_temp.build_numazu_bill_source_record_key(
    '2026-13', 'gi', 1, null
  ) is not null
  then
    raise exception 'Ambiguous Numazu source_record_key must remain null';
  end if;

  if pg_temp.build_numazu_bill_source_record_key(
    null, 'gi', 1, 'mayor'
  ) is not null
  then
    raise exception 'Numazu source_record_key requires a stable session slug';
  end if;
end;
$$;

update bills as bill
set source_record_key = pg_temp.build_numazu_bill_source_record_key(
  session.slug,
  bill.bill_number_kind,
  bill.bill_number_value,
  bill.submitter
)
from council_sessions as session
where bill.council_session_id = session.id
  and bill.source_record_key is null
  and bill.bill_number_kind is not null
  and bill.bill_number_value is not null
  and pg_temp.build_numazu_bill_source_record_key(
    session.slug,
    bill.bill_number_kind,
    bill.bill_number_value,
    bill.submitter
  ) is not null
  and bill.source_url like
    'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/%';

do $$
begin
  if exists (
    select 1
    from bills as bill
    join council_sessions as session on session.id = bill.council_session_id
    where bill.source_record_key is null
      and bill.bill_number_kind is not null
      and bill.bill_number_value is not null
      and pg_temp.build_numazu_bill_source_record_key(
        session.slug,
        bill.bill_number_kind,
        bill.bill_number_value,
        bill.submitter
      ) is not null
      and bill.source_url like
        'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/%'
  ) then
    raise exception 'Numazu source_record_key backfill left eligible rows unresolved';
  end if;
end;
$$;

drop function pg_temp.build_numazu_bill_source_record_key(
  text,
  bill_number_kind_enum,
  integer,
  bill_submitter_enum
);
