# 静岡県議会向け移行計画

- 作成日: 2026-09-03
- 対象: `seiichi3141/numazugikai` `sites/shizuoka-pref/develop`
- 参照元: 沼津市版 `develop`（初期共通コミット `4b43ea656d9d8ebcbaa6ffbbf0f950c674df919b`）
- 状態: 調査・Phase 0 基盤移植段階

## 1. 目的

沼津市議会版で実装済みの公開 Web、管理画面、Supabase、AI 解説、
取り込み worker の構造を活かし、静岡県議会の議案を県民が読みやすい形で
確認できる非公式サービスへ作り替える。

初期 MVP は次を対象とする。

1. 定例会・臨時会の一覧と日程
2. 議案の番号、件名、提出区分、議決結果
3. 公式ページに掲載された会派別および無所属議員別の賛否
4. すべての表示データから公式一次情報へ戻れる出典リンク

AI 解説を初期 MVP に含めるかは公開前に決定する。含める場合も、原資料が揃い、
人による確認を通過した議案だけを公開する。一般質問、会議録解析、動画連携、
県民意見の収集は MVP 後に判断する。

## 2. リポジトリ方針

GitHub は同じ所有者が同一 fork network に複数の fork を作れないため、
本家の fork である `seiichi3141/numazugikai` の中に自治体別 branch を持つ。
これにより GitHub の fork 表示と、`seiichi3141` 所有の静岡県版を両立する。

- `origin`: `git@github.com:seiichi3141/numazugikai.git`
- `upstream`: `team-mirai/mirai-gikai` の参照専用 remote。push は無効化する
- 沼津市版: 当面は既存の `develop` / `main`
- 静岡県版: `sites/shizuoka-pref/develop`。本番環境を用意するまで
  `sites/shizuoka-pref/main` は作成しない
- 作業 branch: `sites/shizuoka-pref/<kind>/<topic>`
- 独立リポジトリで先行した Phase 0 コミット
  `980d9dc511a0358755a36f0944d3e905d4e79a32` は、merge commit の親として
  取り込み、履歴を保持する。移植 PR は squash / rebase しない
- 公開時は AGPL-3.0 第13条に従い、利用者からソースコードへ到達できる
  branch または release tag へのリンクを表示する

## 3. 確認済みの公式データソース

2026-09-03 時点で、次の入口と公開形式を確認した。

| 対象 | 入口 | 形式 | 初期方針 |
| :-- | :-- | :-- | :-- |
| 議案・請願・議決結果 | [議案・請願の内容及び審議結果](https://www.pref.shizuoka.jp/kensei/kengikai/gikaiugoki/1003742/index.html) | HTML、回ごとの PDF | 番号、件名、結果、賛否を保存。全議案の原文が揃う資料とは扱わない |
| 会期・日程 | [県議会の日程・質問議員](https://www.pref.shizuoka.jp/kensei/kengikai/gikaiugoki/1043903/index.html) | HTML | 本会議・委員会の日付、時刻、未定状態、取得日時を正規化 |
| 議員・会派 | [議員の紹介](https://www.pref.shizuoka.jp/kensei/kengikai/giinshokai/index.html) | HTML | 氏名、選挙区、会派のみ。連絡先は取得しない |
| 委員会 | [委員会別議員一覧](https://www.pref.shizuoka.jp/kensei/kengikai/giinshokai/1030746.html) | HTML | 名称と所属を取得。件数をコードへ固定しない |
| 本会議会議録 | [本会議会議録](https://www2.pref.shizuoka.jp/all/ggiji.nsf/) | Domino HTML | MVP ではリンクのみ。非公開仕様の XML に依存しない |
| 委員会会議録 | [委員会会議録](https://www2.pref.shizuoka.jp/all/comgiji.nsf/index) | Domino HTML | MVP ではリンクのみ |
| 生中継・録画 | [本会議インターネット中継](https://shizuoka-pref.stream.jfit.co.jp/) | JFIT HTML/JavaScript | 公式視聴ページへのリンクのみ |
| オープンデータ | [静岡県オープンデータ](https://opendata.pref.shizuoka.jp/dataset/bunya/kensei/gikai/) | カタログ、API | 県議会固有データセットは未確認。存在を前提にしない |

公式の審議結果 HTML は、議案番号、件名、議決結果に加え、会派単位と
無所属議員単位の賛否を掲載している。会派の賛否を所属議員一人ひとりの賛否へ
展開してはならない。また、この HTML はすべての非予算議案の原案全文を含む
統一コーパスではない。原文を取得できない議案は AI 解説の対象外とする。

## 4. 沼津市議会版との重要な差分

| 項目 | 沼津市議会版 | 静岡県議会版で必要な対応 |
| :-- | :-- | :-- |
| 執行機関の長 | 市長 | 知事。DB enum、型、表示を同時に変更 |
| 対象住民 | 市民 | 県民 |
| 行政分野 | 市政 | 県政 |
| 議案番号 | PDF 中心の複数接頭辞 | 提出区分ごとに同じ「第1号」があり得るため、会期・提出区分・番号を複合キーにする |
| 賛否 | 会派別資料を別途抽出 | 審議結果 HTML に会派別と無所属議員別が混在し、賛成・反対・欠席など複数状態がある |
| 議員 | DiscussVision API | 県公式 HTML を正とし、住所・電話・メールは取得しない |
| 会議録 | DiscussVision / AmiVoice | 県公式 Domino と JFIT。非公開 API を安定基盤にしない |
| 取り込み | `packages/numazu-ingest` | `packages/shizuoka-ingest` を新設し、合成 HTML fixture でテスト |

単純な文字列置換では、提出者 enum、賛否モデル、冪等キーが壊れる。
ブランド変更とデータモデル変更を分離して実施する。

## 5. 権利・運用方針

静岡県公式サイトの
[著作権・リンクについて](https://www.pref.shizuoka.jp/about/link.html) は、
掲載情報を原則として著作権の対象とし、著作権法上認められた場合を除く
無断複製・転用を認めていない。一方、静岡県オープンデータは原則 CC BY 4.0
だが、県議会固有データセットは現時点で確認できていない。

そのため、初期実装では次を守る。

- 議案番号、件名、日付、議決結果などの事実を正規化し、出典 URL を保持する
- 公式サイトの写真、イラスト、本文、PDF、動画を複製・再配布しない
- 会議録全文を保存せず、MVP では公式ページへのリンクに留める
- 巡回頻度を抑え、`ETag`、`Last-Modified`、content hash で未変更時をスキップする
- 取得前にホストごとの `robots.txt` とページの robots 指示を確認し、
  `Crawl-delay` と禁止パスを守る。規則は運用中も定期的に再確認する
- parser テストには DOM 構造だけを再現した合成 fixture を使う。公式 HTML の
  スナップショットは、明示的な許諾がない限り Git へ保存しない
- 公開前に静岡県議会事務局へサービス概要、出典、取得頻度、訂正窓口を連絡する
- 公式サイトへのリンク設定後は、県のリンク方針に従い、リンク元とリンク先を
  `PR@pref.shizuoka.lg.jp` へ通知する
- 法務上の最終判断は専門家のレビューを受ける

## 6. 実装フェーズ

### Phase 0: 基盤とガード

- 本家 fork 内に `sites/shizuoka-pref/develop` を作成し、branch protection と
  自治体間の混入を防ぐ branch policy を適用
- 独立リポジトリで先行したコミットを、履歴を保持する merge commit で移植
- README と開発ルールを静岡県議会向けへ更新
- 公式データソースと未確定事項を記録
- 参照元から継承した外部デプロイ・DB 操作を、正確な branch 条件で
  `sites/*` から分離し、静岡県専用環境を用意するまで停止
- local Supabase を project ID `shizuokagikai`、554xx 番台のポートへ分離し、
  `.env.example`、統合テスト、CI の接続先を同時更新

### Phase 1: ブランドと公開面

- `SITE_NAME`、metadata、ヘッダー、フッター、トップ、免責を更新
- 運営主体と訂正窓口の決定前は利用規約を仮文面とし、一般公開しない
- 公式リンクと GitHub リンクを静岡県版へ変更
- ロゴ、テーマカラー、OGP、favicon、PWA アイコンを独自資産へ差し替え
- 沼津固有の画像と文言が公開 bundle に残っていないことをテスト
- この段階では静岡県議会データをまだ公開しない

### Phase 2: 県議会ドメインモデル

- 提出者 `mayor` を `governor` へ移行
- 会期・提出区分・議案番号から安定した外部キーを定義
- 会派単位と無所属議員単位を混在でき、賛成・反対・欠席・除斥・不明を
  区別する多値の賛否モデルへ変更
- 賛否、会派名、議員名は採決時点の表示を履歴として保持し、現在の所属で
  過去の票を再解釈しない
- 欠損列や欠席者がいても、表示文言だけから全列賛成と推定しない
- migration、Supabase 生成型、repository、admin、web、open-data API を同時更新

### Phase 3: 公式 HTML 取り込み

- `packages/shizuoka-ingest` を新設
- 会期、議案・審議結果、議員・会派・委員会の parser と合成 fixture を実装
- 全処理を upsert とし、同一入力を2回処理しても結果が変わらないことを検証
- 低頻度・逐次取得と差分検知を実装
- admin で差分確認後に公開するワークフローを用意

### Phase 4: 解説生成と公開準備

- プロンプトを県政・県民・知事の文脈へ更新
- 公式資料に根拠がない内容を補わない制約と出典表示を追加
- 人によるレビュー完了前は公開しない
- アクセシビリティ、セキュリティ、利用規約、プライバシー、訂正窓口を確認
- 本番データで表示とリンクを確認してからデプロイ
- Vercel など外部サービスの Git 連携と自動デプロイ設定を確認
- 静岡県版専用の OGP スクリーンショット定期実行 workflow / schedule を、
  安全確認後に追加

## 7. 検証ゲート

- `rg` と許容リストによる公開 bundle・実行コード内の `沼津` / `numazu`
  残存確認。参照元の説明、過去 migration、互換識別子は検査対象を分ける
- parser の合成 HTML fixture に対する単体テストと、ローカル一時取得による確認
- Supabase を使った migration と upsert の統合テスト
- `pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm test`
- キーボード、画面拡大、配色、スクリーンリーダーを含むアクセシビリティ確認
- 全ページで非公式性、出典、ソースコードへのリンクを確認
- 公開 URL に対する passive なセキュリティ確認

## 8. 公開前に決める事項

1. 運営主体と訂正依頼の窓口
2. 本番ドメインと問い合わせフォーム
3. AI 解説を MVP に含めるか
4. 一般質問・会議録解析・県民意見収集をどの段階で扱うか
5. 静岡県議会事務局への連絡内容と取得頻度
6. 原文を取得できる議案種別と、AI 解説の対象範囲

運営主体と訂正窓口は Phase 1 の正式文面を確定する前に、取得頻度と連絡方針は
Phase 3 でネットワーク取得を実装する前に決定する。残りの事項は前段の設計を
止めないが、一般公開前には確定する。

現行の沼津市版 workflow は `main` / `develop` だけを外部環境へ接続し、
Supabase Preview と Vercel build も `sites/*` を対象外にする。静岡県版 branch から
沼津市版の Secrets や課金資源を操作してはならない。

Phase 4 で外部環境を有効にする場合は、静岡県版専用の workflow、GitHub
Environment、Secrets、Supabase、Vercel、GCP を用意し、対象 ref を
`sites/shizuoka-pref/develop` または `sites/shizuoka-pref/main` に厳密に限定する。
全検証ゲートと接続先の相互確認が完了するまで `sites/shizuoka-pref/main` は
作成せず、定期 OGP 更新も有効化しない。
