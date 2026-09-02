-- 委員会審査の状況を bills に持たせる。
--
-- 委員会の会議記録には、議案ごとの当局（課長級）の説明と委員の質疑がある。
-- 「質疑が26回あった議案」と「質疑なしで通った議案」の差は、
-- 議決結果がほぼ全件「可決」になる市議会で、議案の注目度を示す数少ない事実になる。

alter table bills
  -- 委員会での質疑の発言数。null は未取得、0 は質疑なしで審査されたことを示す
  add column committee_qa_count integer,
  -- 委員会の会議記録（会議記録検索システム）の該当ページ
  add column committee_minutes_url text;

comment on column bills.committee_qa_count is
  '付託委員会での委員の質疑の発言数。null=未取得 / 0=質疑なし';
comment on column bills.committee_minutes_url is
  '委員会の会議記録の閲覧ページURL。本文は保持せずリンクのみ持つ';
