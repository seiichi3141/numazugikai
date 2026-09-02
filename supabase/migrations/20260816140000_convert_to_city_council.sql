-- 国会（二院制）前提のスキーマを、沼津市議会（一院制）向けに作り替える。
--
-- 主な変更:
--   1. diet_sessions -> council_sessions（定例会・臨時会）
--   2. bills から二院制の概念（originating_house / house_enum）を落とす
--   3. bills に市議会の議案情報（議案番号・分類・付託委員会・議決日）を持たせる
--   4. 委員会・会派・議員・会派別賛否のテーブルを追加
--   5. 取り込みの冪等性・差分検知用のテーブルを追加
--
-- RLS はすべて有効化するがポリシーは定義しない（デフォルト全拒否）。
-- アクセスは createAdminClient() 経由、認可はアプリケーション層で行う。

-- ============================================================
-- 1. 会期: diet_sessions -> council_sessions
-- ============================================================

alter table diet_sessions rename to council_sessions;
alter table council_sessions rename column shugiin_url to source_url;

create type council_session_kind_enum as enum (
  'regular',        -- 定例会
  'extraordinary'   -- 臨時会
);

alter table council_sessions
  add column session_number integer,
  add column kind council_session_kind_enum not null default 'regular',
  -- 議会中継システム（DiscussVision）の council_id。取り込みの突合キー
  add column external_council_id text;

comment on table council_sessions is '沼津市議会の定例会・臨時会';
comment on column council_sessions.session_number is '回次（例: 第13回定例会の 13）';
comment on column council_sessions.source_url is '沼津市議会サイトの該当ページ';
comment on column council_sessions.external_council_id is '議会中継システム（DiscussVision SMART）の council_id';

-- 部分インデックスは ON CONFLICT の推論に使えないため通常の一意制約にする。
-- Postgres は UNIQUE 制約でも NULL 同士を重複とみなさない。
alter table council_sessions
  add constraint council_sessions_external_council_id_key
  unique (external_council_id);

-- 関数名も市議会向けに置き換える
drop function if exists set_active_diet_session(uuid);

create or replace function set_active_council_session(target_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update council_sessions
  set is_active = (id = target_session_id)
  where id is not null;
end;
$$;

comment on function set_active_council_session(uuid) is
  'トップページに表示する会期を1つだけ有効にする。複数同時有効を避けるため単一UPDATEで行う。';

-- ============================================================
-- 2. 委員会
-- ============================================================

create type committee_kind_enum as enum (
  'standing',   -- 常任委員会
  'steering',   -- 議会運営委員会
  'special'     -- 特別委員会
);

create table committees (
  id uuid primary key default gen_random_uuid(),
  -- 正式名称（例: 総務経済委員会）
  name text not null,
  -- 議案審議結果PDFで使われる略称（例: 総務経済）。突合キーになる
  short_name text not null,
  kind committee_kind_enum not null default 'standing',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (short_name)
);

alter table committees enable row level security;

comment on table committees is '沼津市議会の委員会。short_name は議案審議結果PDFの表記に合わせる';

create trigger update_committees_updated_at
  before update on committees
  for each row execute function update_updated_at_column();

-- ============================================================
-- 3. 会派・議員
-- ============================================================

create table factions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  -- 議会だよりの賛否表に載る所属人数
  member_count integer,
  -- 議会中継システムの会派ID
  external_group_id text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

alter table factions enable row level security;

comment on table factions is '沼津市議会の会派。議員個人単位の賛否は公開されていないため、賛否は会派単位で扱う';

create trigger update_factions_updated_at
  before update on factions
  for each row execute function update_updated_at_column();

-- 議員。電話番号・自宅住所は公開情報だが本サービスでは取り込まない
create table council_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_kana text,
  seat_number integer,
  faction_id uuid references factions(id) on delete set null,
  -- 党派（会派とは別。例: 自由民主党）
  party text,
  photo_url text,
  -- 議会中継システムの speaker_id
  external_speaker_id text,
  term_start date,
  term_end date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table council_members enable row level security;

comment on table council_members is
  '沼津市議会議員。個人情報保護のため電話番号・自宅住所は保持しない';

alter table council_members
  add constraint council_members_external_speaker_id_key
  unique (external_speaker_id);
create index if not exists idx_council_members_faction_id
  on council_members (faction_id);

create trigger update_council_members_updated_at
  before update on council_members
  for each row execute function update_updated_at_column();

create table committee_memberships (
  committee_id uuid not null references committees(id) on delete cascade,
  council_member_id uuid not null references council_members(id) on delete cascade,
  -- 委員長 / 副委員長 / 委員
  role text,
  created_at timestamptz not null default now(),
  primary key (committee_id, council_member_id)
);

alter table committee_memberships enable row level security;

-- ============================================================
-- 4. 議案 (bills) の市議会化
-- ============================================================

alter table bills rename column diet_session_id to council_session_id;
alter table bills rename column shugiin_url to source_url;

-- 二院制の概念を落とす
alter table bills drop column originating_house;
drop type house_enum;

create type bill_number_kind_enum as enum (
  'gi',       -- 議第◯号
  'hou',      -- 報第◯号（報告）
  'nin',      -- 認第◯号（人事同意・専決承認）
  'hatsugi',  -- 発議第◯号（議員提出）
  'seigan',   -- 請願第◯号
  'chinjo'    -- 陳情第◯号
);

create type bill_category_enum as enum (
  'ordinance',             -- 条例（地方自治法96条1項1号）
  'budget',                -- 予算（2号）
  'settlement',            -- 決算（3号）
  'contract',              -- 契約・財産（4〜14号）
  'provisional_approval',  -- 専決承認（179条関係）
  'report',                -- 報告（180条関係ほか）
  'personnel',             -- 人事同意
  'opinion_paper',         -- 意見書・決議（発議）
  'petition',              -- 請願・陳情
  'other'
);

create type bill_submitter_enum as enum (
  'mayor',      -- 市長
  'member',     -- 議員
  'committee',  -- 委員会
  'citizen'     -- 市民（請願・陳情）
);

alter table bills
  add column bill_number text,
  add column bill_number_kind bill_number_kind_enum,
  add column bill_number_value integer,
  add column category bill_category_enum,
  add column submitter bill_submitter_enum,
  add column committee_id uuid references committees(id) on delete set null,
  -- 委員会審査結果（例: 可決すべきもの）。付託省略は null
  add column committee_result text,
  add column decided_on date,
  -- 根拠条項（例: 地方自治法第96条第1項第1号）
  add column legal_basis text,
  -- 議案本文PDFのURL。本文は保持せずリンクのみ持つ
  add column document_url text;

comment on column bills.bill_number is '議案番号の表記（例: 議第58号）';
comment on column bills.document_url is
  '議案本文PDFのURL。著作権上、本文そのものは保持せずリンクのみ持つ';
comment on column bills.source_url is '沼津市議会サイトの該当ページ';

-- 同一会期内で議案番号は一意
alter table bills
  add constraint bills_session_bill_number_key
  unique (council_session_id, bill_number);
create index if not exists idx_bills_committee_id on bills (committee_id);
create index if not exists idx_bills_category on bills (category);

-- ------------------------------------------------------------
-- 議案ステータスを一院制の審議フローに合わせて差し替える
-- ------------------------------------------------------------

create type bill_status_enum_v2 as enum (
  'preparing',     -- 準備中（公開前）
  'submitted',     -- 提出
  'in_committee',  -- 委員会付託中
  'passed',        -- 可決
  'rejected',      -- 否決
  'consented',     -- 同意（人事案件）
  'approved',      -- 承認（専決処分の承認）
  'certified',     -- 認定（決算）
  'adopted',       -- 採択（請願・陳情）
  'not_adopted',   -- 不採択
  'continued',     -- 継続審査
  'withdrawn',     -- 撤回
  'reported'       -- 報告済
);

-- status に依存する generated column を一度落とし、型を差し替えてから作り直す
drop index if exists idx_bills_status_order;
alter table bills drop column status_order;

alter table bills
  alter column status drop default,
  alter column status type bill_status_enum_v2
    using (
      case status::text
        when 'preparing' then 'preparing'
        when 'introduced' then 'submitted'
        when 'in_originating_house' then 'in_committee'
        when 'in_receiving_house' then 'in_committee'
        when 'enacted' then 'passed'
        when 'rejected' then 'rejected'
        else 'preparing'
      end
    )::bill_status_enum_v2,
  alter column status set default 'preparing'::bill_status_enum_v2;

drop type bill_status_enum;
alter type bill_status_enum_v2 rename to bill_status_enum;

-- 結論が出たものを先頭に、審議の進み具合の順で並べ直す
alter table bills add column status_order int generated always as (
  case status
    when 'passed'       then 0
    when 'consented'    then 1
    when 'approved'     then 2
    when 'certified'    then 3
    when 'adopted'      then 4
    when 'rejected'     then 5
    when 'not_adopted'  then 6
    when 'withdrawn'    then 7
    when 'continued'    then 8
    when 'reported'     then 9
    when 'in_committee' then 10
    when 'submitted'    then 11
    when 'preparing'    then 12
  end
) stored;

create index idx_bills_status_order on bills (status_order);

-- ============================================================
-- 5. 会派別賛否
-- ============================================================

create type faction_vote_enum as enum (
  'for',       -- 賛成
  'against',   -- 反対
  'split',     -- 会派内で割れた（無所属など）
  'excluded'   -- 除斥
);

create table faction_votes (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  faction_id uuid not null references factions(id) on delete cascade,
  vote faction_vote_enum not null,
  -- vote = 'split' のときの内訳
  for_count integer,
  against_count integer,
  -- 出典（議会だよりの該当号）。必ず持たせる
  source_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bill_id, faction_id)
);

alter table faction_votes enable row level security;

comment on table faction_votes is
  '会派別の賛否。議会だよりには賛否が分かれた議案しか載らないため、レコードがない議案は全会一致とみなす';

create index if not exists idx_faction_votes_bill_id on faction_votes (bill_id);

create trigger update_faction_votes_updated_at
  before update on faction_votes
  for each row execute function update_updated_at_column();

-- ============================================================
-- 6. 取り込み管理
-- ============================================================

create table ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  -- discussvision | gian_pdf | dayori_pdf | schedule_html | bill_documents
  source text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb,
  error text
);

alter table ingestion_runs enable row level security;

create index if not exists idx_ingestion_runs_source_started
  on ingestion_runs (source, started_at desc);

-- 取得済みURLの内容ハッシュ。変わっていなければ再取得・再解析をスキップする
create table ingestion_sources (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  url text not null,
  content_hash text,
  etag text,
  last_modified text,
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, url)
);

alter table ingestion_sources enable row level security;

create trigger update_ingestion_sources_updated_at
  before update on ingestion_sources
  for each row execute function update_updated_at_column();
