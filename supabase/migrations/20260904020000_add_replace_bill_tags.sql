drop function if exists public.replace_bill_tags(uuid, uuid[]);

create or replace function public.replace_bill_tags(
  p_bill_id uuid,
  p_managed_tag_ids uuid[],
  p_next_tag_ids uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.bills_tags
  where bill_id = p_bill_id
    and tag_id = any(p_managed_tag_ids);

  insert into public.bills_tags (bill_id, tag_id)
  select p_bill_id, tag_id
  from unnest(coalesce(p_next_tag_ids, array[]::uuid[])) as tag_id
  on conflict (bill_id, tag_id) do nothing;
end;
$$;

revoke execute on function public.replace_bill_tags(uuid, uuid[], uuid[]) from public;
revoke execute on function public.replace_bill_tags(uuid, uuid[], uuid[]) from anon;
revoke execute on function public.replace_bill_tags(uuid, uuid[], uuid[]) from authenticated;
grant execute on function public.replace_bill_tags(uuid, uuid[], uuid[]) to service_role;

comment on function public.replace_bill_tags(uuid, uuid[], uuid[]) is
  '議案のAI管理対象テーマタグだけを単一トランザクションで指定集合に置換する';
