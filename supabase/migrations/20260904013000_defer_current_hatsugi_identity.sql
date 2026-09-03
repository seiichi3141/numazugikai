-- 開会中ページでは、発議が議員提出か委員会提出かを確定できない。
-- 旧parserおよび0100 backfillが議員提出と推測したrecordを未確定へ戻し、
-- 結果PDFの正式な提出者でsource_record_keyを安全に昇格できるようにする。
update bills
set
  source_record_key = null,
  submitter = null
where bill_number_kind = 'hatsugi'
  and source_record_key ~ '^numazu-city:[^:]+:member_bill:member:numbered:hatsugi-[0-9]+$'
  and (
    submitter is null
    or (
      submitter = 'member'
      and source_url = 'https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/oshirase.htm'
    )
  );
