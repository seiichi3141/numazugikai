# みらい議会＠沼津市

沼津市議会の議案を、市民が読んで意見を出せる形にして公開するサービスです。

本リポジトリは国会向けサービス「[みらい議会](https://github.com/team-mirai/mirai-gikai)」の fork です。
議案・会期・議員・会議録はすべて沼津市議会の公開情報から取り込んでいます。

## 自治体別の開発

GitHub 上の fork 関係を保ったまま複数自治体版を開発するため、自治体ごとに
`sites/<自治体>/develop` と `sites/<自治体>/main` を持つ方針です。
現在の `develop` / `main` は、稼働中のデプロイとの互換性を保つため当面は
沼津市版として維持します。静岡県版は `sites/shizuoka-pref/develop` で開発します。

命名、PR の向き先、共通変更の取り込み方は
[複数自治体ブランチ運用方針](docs/20260903_1906_複数自治体ブランチ運用方針.md)
を参照してください。

## セットアップ

```bash
# Supabaseの起動
npx supabase start

# 環境変数の設定（必要に応じて.envの内容を変更してください）
cp .env.example .env

# パッケージインストール
pnpm install

# SupabaseのDB初期化 + シード（タグ・Adminユーザー）
pnpm db:reset

# 沼津市議会の議案データを取り込む（下記「議案データの取り込み」を参照）
pnpm --filter @mirai-gikai/topic-analysis-worker run ingest --target=sessions
pnpm --filter @mirai-gikai/topic-analysis-worker run ingest --target=members
pnpm --filter @mirai-gikai/topic-analysis-worker run ingest --target=bills --era-year=8 --month=6
pnpm --filter @mirai-gikai/topic-analysis-worker run ingest --target=amivoice

# 取り込んだ議案にタグとデモデータを紐づける
pnpm seed

# サーバー起動
pnpm dev
```

## 議案データの取り込み

**議案・会期はシードでは作りません。** `pnpm db:reset` 直後の `bills` は0件で、
実際の議案は取り込み（`@mirai-gikai/numazu-ingest`）が沼津市議会の公開情報から投入します。

```bash
# 会期（定例会・臨時会）
pnpm --filter @mirai-gikai/topic-analysis-worker run ingest --target=sessions

# 議員
pnpm --filter @mirai-gikai/topic-analysis-worker run ingest --target=members

# 議案（会期を指定。--month を省略するとその年の定例会をまとめて取り込む）
pnpm --filter @mirai-gikai/topic-analysis-worker run ingest --target=bills --era-year=8 --month=6

# 会議録（AmiVoice）
pnpm --filter @mirai-gikai/topic-analysis-worker run ingest --target=amivoice
```

取り込みには `.env` の環境変数が必要です。

## シードデータ

`pnpm seed`（`pnpm db:reset` からも実行されます）が作るのは次の3つだけです。
議案・会期・議員は取り込みの担当なので、シードは触りません。
そのため取り込みのあとにもう一度 `pnpm seed` を実行すると、実際の議案に紐づいたデモデータが揃います。

| 作るもの | 内容 |
| --- | --- |
| Adminユーザー | ローカル接続時のみ（下記参照） |
| タグ | 「子育て・教育」「医療・福祉」など市政のテーマ別タグ。取り込み済みの議案に議案名から自動で紐づける |
| デモデータ | インタビュー・トピック分析の開発用。取り込み済みの実在議案に紐づける |

議案が1件も取り込まれていない状態で `pnpm seed` を実行した場合、タグだけを作ってデモデータはスキップします。

## マイグレーション

```bash
# マイグレーションファイル生成
npx supabase migration new マイグレーション名

# マイグレーション実行 & 型ファイル更新
pnpm db:migrate
```

## Adminユーザーの作成

1. Supabase Studio上で Authentication > Add User からユーザーを作成
2. Supabase Studio上で以下のSQLを実行

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"roles": ["admin"]}'::jsonb
WHERE email = '<1で作成したユーザーのemail>';
```

> [!NOTE]
> ローカル開発環境では、`pnpm seed`（`pnpm db:reset` からも実行されます）によって `email: admin@example.com, password: admin123456` のAdminユーザーが作成されます。
> このAdminユーザーは `SUPABASE_URL` が localhost を指している場合のみ作成され、ホスト環境（staging・preview ブランチ等）には作成されません。
> メールアドレス・パスワードを変えたい場合は `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` を設定してください。

## Fork して独自サービスを運営する場合

本リポジトリをさらに fork して独自にサービスを運営する場合は、[Fork ガイドライン](./FORK_GUIDELINES.md) を確認してください。本家サービスとの混同防止のため、ロゴ・カラー・サービス名称などの変更が必要です。
