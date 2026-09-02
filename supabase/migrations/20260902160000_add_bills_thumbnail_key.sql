-- 議案サムネイルの題材キーを持たせる。
--
-- 議案ごとの写真は用意せず、内容に近い題材（学校施設・予算・人事など）の
-- 概念画像を当てる。どの題材かは bill-explainer が LLM で決めて保存する。
-- 値は @mirai-gikai/shared の BILL_THUMBNAIL_SUBJECTS の key と一致させる。

alter table bills add column if not exists thumbnail_key text;

comment on column bills.thumbnail_key is
  'サムネイルの題材キー（web/public/img/bill-thumbnails/<key>.webp）。thumbnail_url があればそちらを優先';

-- 一覧 RPC の戻り値に列を足す。戻り値の型が変わるため作り直す。
-- count_bills_for_list_facets は bills_list_rows を w.* で読むだけなので触らない。
drop function if exists search_bills_for_list(
  difficulty_level_enum, text, uuid, text, boolean, text, integer, integer
);
drop function if exists bills_list_rows(difficulty_level_enum, text, boolean);

/**
 * 一覧に出せる議案のうち、キーワードと「受付中のみ」で絞った母集合。
 *
 * 検索とファセット件数の両方がこれを土台にする。同じ述語を二重に書くと、
 * 片方だけ直したときに「タブの件数と一覧の中身が食い違う」形で壊れる。
 *
 * タグは jsonb にまとめない。ここで組み立てると母集合の全行ぶん作ることに
 * なり、実際に要るのは表示する30件だけ。絞り込みも bills_tags を直接見た
 * ほうが主キー索引 (bill_id, tag_id) が効く。
 *
 * 回答数もここでは数えない。並び替えに必要なのは検索側だけ。
 */
create or replace function bills_list_rows(
  p_difficulty difficulty_level_enum,
  p_query text default '',
  p_interview_only boolean default false
)
returns table (
  id uuid,
  name text,
  bill_number text,
  status bill_status_enum,
  status_note text,
  submitted_date timestamptz,
  updated_at timestamptz,
  thumbnail_url text,
  thumbnail_key text,
  is_review_completed boolean,
  status_order integer,
  content_title text,
  content_summary text,
  has_public_interview boolean
)
language sql
stable
as $$
  select
    b.id, b.name, b.bill_number, b.status, b.status_note,
    b.submitted_date, b.updated_at, b.thumbnail_url, b.thumbnail_key,
    b.is_review_completed, b.status_order,
    c.title, c.summary,
    exists (
      select 1 from interview_configs ic
      where ic.bill_id = b.id and ic.status = 'public'
    )
  from bills b
  join bill_contents c
    on c.bill_id = b.id and c.difficulty_level = p_difficulty
  where b.publish_status = 'published'
    -- キーワードは正式名称・タイトル・要約・タグ名を対象にする
    and (
      normalize_search_text(p_query) = ''
      or normalize_search_text(b.name) like '%' || normalize_search_text(p_query) || '%'
      or normalize_search_text(c.title) like '%' || normalize_search_text(p_query) || '%'
      or normalize_search_text(c.summary) like '%' || normalize_search_text(p_query) || '%'
      or exists (
        select 1 from bills_tags bt join tags t on t.id = bt.tag_id
        where bt.bill_id = b.id
          and normalize_search_text(t.label)
              like '%' || normalize_search_text(p_query) || '%'
      )
    )
    and (
      not p_interview_only
      or exists (
        select 1 from interview_configs ic2
        where ic2.bill_id = b.id and ic2.status = 'public'
      )
    );
$$;
comment on function bills_list_rows is
  '一覧に出せる公開議案の母集合（キーワード・受付中まで適用）。検索とファセット件数が共有する';

/**
 * 議案一覧を検索して1ページ分を返す。
 *
 * 返り値に total_count を含めるのは、ページ番号の表示に総件数が要るため。
 * 別クエリにすると絞り込み条件を二重に書くことになり、ずれる。
 */
create or replace function search_bills_for_list(
  p_difficulty difficulty_level_enum,
  p_query text default '',
  p_tag_id uuid default null,
  p_status_group text default 'all',
  p_interview_only boolean default false,
  p_sort text default 'voices',
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  bill_number text,
  status bill_status_enum,
  status_note text,
  submitted_date timestamptz,
  updated_at timestamptz,
  thumbnail_url text,
  thumbnail_key text,
  is_review_completed boolean,
  content_title text,
  content_summary text,
  tags jsonb,
  has_public_interview boolean,
  public_report_count bigint,
  total_count bigint
)
language sql
stable
as $$
  with filtered as (
    select w.* from bills_list_rows(p_difficulty, p_query, p_interview_only) w
    where (
        p_tag_id is null
        or exists (
          select 1 from bills_tags bt
          where bt.bill_id = w.id and bt.tag_id = p_tag_id
        )
      )
      and (p_status_group = 'all' or bill_status_group(w.status) = p_status_group)
  ),
  counted as (
    -- 「公開」の定義は count_public_reports_by_bill_ids が持つ。ここで述語を
    -- 書き直すと、一覧のバッジだけ議案詳細やオープンデータAPIと違う数字に
    -- なる。相関サブクエリで1行ずつ数えるのも避ける（並び替えのキーと
    -- 選択リストで二重に評価され、まとめて数えるより桁違いに遅い）。
    select f.*, coalesce(rc.report_count, 0) as public_report_count
    from filtered f
    left join count_public_reports_by_bill_ids(
      (select array_agg(id) from filtered)
    ) rc on rc.bill_id = f.id
  )
  select
    c.id, c.name, c.bill_number, c.status, c.status_note,
    c.submitted_date, c.updated_at, c.thumbnail_url, c.thumbnail_key,
    c.is_review_completed, c.content_title, c.content_summary,
    -- タグはページに残る30件ぶんだけ組み立てる
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', t.id, 'label', t.label)
                         order by t.label)
        from bills_tags bt join tags t on t.id = bt.tag_id
        where bt.bill_id = c.id
      ),
      '[]'::jsonb
    ),
    c.has_public_interview, c.public_report_count,
    count(*) over () as total_count
  from counted c
  order by
    case when p_sort = 'voices' then c.public_report_count end desc nulls last,
    case when p_sort = 'new' then c.submitted_date end desc nulls last,
    case when p_sort = 'old' then c.submitted_date end asc nulls last,
    case when p_sort = 'updated' then c.updated_at end desc nulls last,
    case when p_sort = 'status' then c.status_order end asc nulls last,
    -- 同点でも並びを一意に決める。決まらないとページをまたいで同じ議案が
    -- 二度出たり、どのページにも出ない議案ができる。
    c.submitted_date desc nulls last,
    c.id
  limit p_limit offset p_offset;
$$;
comment on function search_bills_for_list is
  '議案一覧の検索・絞り込み・並び替え・ページング。total_count に絞り込み後の総件数を含む';
