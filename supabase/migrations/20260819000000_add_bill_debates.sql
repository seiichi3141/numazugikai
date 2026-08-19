-- 議案に討論があったかどうかを保持する。
--
-- 沼津市議会では市長提出議案のほとんどが可決されるため、議決結果だけでは
-- 「議論のあった議案」と「淡々と通った議案」の区別がつかない。
-- 本会議の討論（賛成・反対の意見表明）の有無が、その区別を与える唯一の手がかりになる。
--
-- 討論の本文は保持しない。著作権上、議員の発言は議員個人に帰属し、
-- 40条の解釈も分かれるため、原文は公式の会議録・中継へリンクする。
-- ここで持つのは「誰が」「どの議案に」「どちらの立場で」討論したかという事実のみ。

create type debate_stance_enum as enum ('for', 'against');

create table bill_debates (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  -- 会議録の表記そのままの議員名（"山下富美子" など）
  speaker_name text not null,
  -- 議席番号。会議録から読み取れなければ null
  seat_number integer,
  -- 議員マスタと突合できた場合のみ紐づける
  council_member_id uuid references council_members(id) on delete set null,
  stance debate_stance_enum not null,
  -- AIで抽出した論点の要約。原文は入れない
  summary text,
  -- 出典（沼津市議会の会議録・中継の該当ページ）
  source_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bill_id, speaker_name, stance)
);

alter table bill_debates enable row level security;

comment on table bill_debates is
  '本会議での討論。討論の有無が「議論のあった議案」を見つける手がかりになる。原文は保持しない';
comment on column bill_debates.summary is
  'AIで抽出した論点の要約。会議録の原文をそのまま入れてはならない';

create index if not exists idx_bill_debates_bill_id on bill_debates (bill_id);

create trigger update_bill_debates_updated_at
  before update on bill_debates
  for each row execute function update_updated_at_column();

-- 議案の当局説明。AIが市民向けの解説を書くための材料として保持する。
-- 会議録のうち当該議案の説明部分に限って切り出したもので、会議録全文は保持しない。
alter table bills
  add column explanation_source text;

comment on column bills.explanation_source is
  '会議録から切り出した当局の議案説明。AI解説の材料として使う。会議録全文は保持しない';
