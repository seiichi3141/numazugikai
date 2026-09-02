-- 本家ドメイン（@team-mir.ai）の Google ログインに admin ロールを自動付与する
-- 仕組みを廃止する。
--
-- 20260427100000 で入った仕組みで、本家（国会版・チームみらい運営）では
-- 運営メンバーの初期設定として妥当だった。沼津版はフォークであり運営主体が
-- 別なので、本家のドメインを持つ人が沼津版の管理画面にログインしただけで
-- 管理者になってしまう。
--
-- 沼津版の運営主体は未確定のため、別のドメインに置き換えることはしない。
-- 管理者の付与は admin の管理者ページから明示的に行う。ドメインで自動付与
-- したくなった場合は、運営主体が決まってから改めて入れること。

drop trigger if exists on_auth_user_created_set_admin_role on auth.users;
drop function if exists public.handle_google_workspace_admin_role();
drop function if exists public.apply_admin_role_if_eligible(uuid);

-- 既に自動付与されている本家ドメインのユーザーから admin ロールを外す。
-- 仕組みだけ消しても、付与済みの権限は残ったままになる。
update auth.users
set raw_app_meta_data = jsonb_set(
  raw_app_meta_data,
  '{roles}',
  (raw_app_meta_data->'roles') - 'admin'
)
where email ilike '%@team-mir.ai'
  and raw_app_meta_data->>'provider' = 'google'
  and raw_app_meta_data->'roles' @> '["admin"]';
