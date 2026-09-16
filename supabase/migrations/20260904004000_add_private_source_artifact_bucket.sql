-- Parser根拠を同じ設定で再解析できるよう、取得時の原本を非公開で保持する。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'source-artifacts',
  'source-artifacts',
  false,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
