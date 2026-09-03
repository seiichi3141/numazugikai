-- DiscussVision の発言ページは speaker_id と target_year が必須。
-- 既存の取込処理が3つのIDだけを保存していたため、リンク先の内部APIが
-- speaker_id=undefined で500になっていた。会期の開始年を使って既存URLを補完する。
update bill_debates as debate
set source_url = debate.source_url
  || case
    when debate.source_url like '%speaker_id=%' then ''
    else '&speaker_id=null'
  end
  || '&target_year='
  || extract(year from session.start_date)::integer::text
from bills as bill
join council_sessions as session on session.id = bill.council_session_id
where debate.bill_id = bill.id
  and debate.source_url like
    'https://smart.discussvision.net/smart/tenant/numazu/WebView/rd/speech.html?%'
  and debate.source_url not like '%target_year=%';
