# みらい議会＠静岡県

静岡県議会の議案を、県民が読みやすい形で届ける非公式サービスです。

> [!IMPORTANT]
> 現在は静岡県議会版への移行中です。コードには参照元である沼津市議会版の
> 表示・データ取得処理が残っているため、公開環境へデプロイしないでください。

本リポジトリは
[みらい議会＠沼津市](https://github.com/seiichi3141/numazugikai) の
`develop` ブランチ（`4b43ea656d9d8ebcbaa6ffbbf0f950c674df919b`）から履歴を
引き継いで作成した独立リポジトリです。さらにその基になった国会向けサービス
[みらい議会](https://github.com/team-mirai/mirai-gikai) と同じく、
AGPL-3.0 および [Fork ガイドライン](./FORK_GUIDELINES.md) に従います。

移行の方針、公式データソース、実装順序は
[静岡県議会向け移行計画](./docs/20260903_1741_shizuoka-prefecture-migration-plan.md)
を参照してください。

## 現在利用できる準備と静的検証

静岡県版のローカル実行環境は移行中です。Node.js 22 と、ルート
`package.json` で固定した pnpm 10.33.0 を使用してください。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
```

## 移行中の制約

- `packages/numazu-ingest` は参照元の取り込み処理であり、静岡県議会では
  使用しません。静岡県議会向け取り込みが完成するまでは実行しないでください。
- local Supabase は project ID `shizuokagikai` と 554xx 番台のポートを使い、
  沼津市議会版から分離しています。既存の `.env` を流用せず、接続先が
  `http://127.0.0.1:55421` であることを確認してください。
- 現在の DB には提出者 `mayor` など沼津市議会由来の定義が残っています。
  UI 文言だけを先行して置換せず、マイグレーション・型・テストを同じ PR で
  更新します。
- ロゴ、配色、OGP、PWA アイコンを静岡県版へ差し替え、公式サービスではない旨を
  全画面で確認できる状態になるまで公開しません。
- 参照元から継承した Vercel、Supabase、Cloud Run の新規作成・更新・
  デプロイ処理は、GitHub Actions の Repository variable
  `SHIZUOKA_DEPLOYMENTS_ENABLED` を `true` に設定するまで実行されません。
  Phase 4 の公開準備が完了するまで設定しないでください。課金資源を残さないため、
  過去に作成済みの preview を削除する cleanup だけは無効化中も実行できます。
- OGP スクリーンショット更新は定期実行も外してあります。公開準備時に実行変数と
  Secrets を確認したうえで schedule を復元します。
- Vercel などの Git 連携による自動デプロイは Actions の実行変数では止まりません。
  外部サービス側で本リポジトリが未接続または自動デプロイ無効であることも
  公開準備時に確認します。

## 予定している公式データソース

機械的に取り込む対象は、静岡県議会の公式ページで公開された事実情報を基本とし、
各レコードに出典 URL を保持します。

- [議案・請願の内容及び審議結果](https://www.pref.shizuoka.jp/kensei/kengikai/gikaiugoki/1003742/index.html)
- [県議会の日程・質問議員](https://www.pref.shizuoka.jp/kensei/kengikai/gikaiugoki/1043903/index.html)
- [議員の紹介](https://www.pref.shizuoka.jp/kensei/kengikai/giinshokai/index.html)
- [本会議インターネット中継](https://shizuoka-pref.stream.jfit.co.jp/)

公式サイトの文章・写真・PDF・動画は原則として複製せず、必要な一次資料へ
リンクします。

## シードデータ

現在の seed は、タグを含めて沼津市議会版のデータを削除・再投入します。
静岡県用データへ置き換えるまで `pnpm db:reset` と `pnpm seed` は実行しません。
既存 migration は履歴として変更せず、静岡県向けの変更は新しい forward migration
として追加します。

## ライセンスと非公式性

本サービスは静岡県および静岡県議会が運営・監修する公式サービスではありません。
正確な情報は、必ず静岡県議会の公式ページで確認してください。

本リポジトリを利用・改変して公開する場合は、AGPL-3.0 と
[Fork ガイドライン](./FORK_GUIDELINES.md) を確認してください。
