# 財政データ契約

- 作成日: 2026-09-04
- 対象: みらい議会＠沼津市の予算・決算可視化
- 実装計画: [沼津市の予算・決算可視化 実装計画](./20260903_1555_予算決算可視化実装計画.md)

## この文書の範囲

予算・決算可視化の最初の実装単位として、DBで保持する安定ID、訂正版、出典、
金額の意味を定義する。初期データの取込、公開API、画面は後続PRで追加する。

共通の取得版・解析履歴は
`20260903231500_add_common_ingestion_audit_foundation.sql`を利用し、財政側で
再定義しない。

## 混同してはいけない軸

| 軸 | 正本 | 例 |
| :-- | :-- | :-- |
| 法定会計 | `fiscal_accounts` | 一般会計、国民健康保険事業特別会計 |
| 集計範囲 | `fiscal_reporting_scopes` | 一般会計、全会計合計、普通会計 |
| 金額イベント | `fiscal_events.event_kind` | 当初予算、補正予算、予算現額、決算 |
| 議決段階 | `fiscal_amount_sets.decision_stage` | 提案、可決、該当なし |
| 公開版 | 各revisionの`publication_state` | draft、reviewed、published、superseded |
| 議会の判断 | `fiscal_event_bill_link_revisions`と`bills` | 可決、認定、不認定 |

普通会計は統計上の集計範囲であり、法定の一般会計とは別物である。
決算額は議会の認定状態が変わっても複製せず、議案リンク側で認定状態を表す。

## 年度と会計

`fiscal_year`は年度が始まる西暦年を整数で保持する。令和8年度は`2026`である。
会計には有効開始年度と終了年度を持たせ、同じ`code`の期間重複と、有効期間外の
membership・eventをDBで拒否する。
会計を持つeventは、同じ年度・集計範囲・会計のmembershipを必須参照とし、
存在しない構成や別集計範囲のmembershipを使った記録を拒否する。
会計期間は通常のアプリケーション操作では変更しない。将来の法的な廃止や期間訂正は、
影響する参照年度を検査し、既存履歴を残す専用migrationでのみ行う。

初期値として次の安定IDを登録する。

- 会計: `general`（一般会計）
- 集計範囲: `general_account`（一般会計）
- 集計範囲: `all_accounts`（公式資料の全会計合計）
- 集計範囲: `ordinary_account`（自治体比較用の普通会計）

## 金額と欠損

正規金額は`bigint`の円単位で保持する。表示用の億円・万円への丸めは保存しない。
APIではJavaScriptの数値精度に依存しないよう10進文字列へ変換する。

- `amount_yen = 0`: 原資料が明示した0円。
- `amount_yen is null`: 値を確定できない状態。`null_reason`を必須にする。
- 負値: 補正減額等の有効な値。欠損にはしない。

欠損理由は`not_published`、`not_applicable`、`unreadable`、`suppressed`、
`unknown_dash`のいずれかとする。

## 版と出典

安定IDには、資料差し替えで変わらない意味だけを置く。値、表示名、QA判断は
revisionまたはobservationへ追記し、公開版を1件だけ選択する。
安定IDとsource occurrenceはUPDATE・DELETE・TRUNCATEを禁止する。最初の基盤PRでは
revision、observation、evidenceも追記専用として凍結し、後続の公開ワークフローPRで
監査対象列を変えずに状態だけを進める専用関数へ置き換える。

出典は次の順にたどれることを必須とする。

```text
正規金額
  -> 金額revision
  -> 原表内の金額出現
  -> 金額セット出典
  -> 資料edition観測
  -> 共通source version
  -> 共通parse run（parser由来の場合）
```

原表記、原単位、ページ・表・セル、円換算値を根拠行に残す。取得URLだけを版IDに
せず、共通source versionのSHA-256と取得日時で差し替えを識別する。
同じsource occurrence・source version・parse run・evidence revisionは別の対象revisionへ
再割当しない。parser再解析は新しいparse run、人手による再解釈は増分したevidence
revisionとして追記する。

## Coverageと年度間分類

`fiscal_data_coverage`は金額の欠損とは別に、資料、membership、金額セット、分類、
年度間mapping、指標、議案リンクが収集対象として存在するかを保持する。
未公表、取得不能、部分取得、解析失敗、確認済み0件を別の観測として追記し、
未確認を0件へ丸めない。nullableな会計と基準日も生成identity keyを介した複合外部キーで
正本・資料内出現・観測・根拠の全階層へ固定する。

分類の原コード・原名称・担当部局は版別根拠へ保存する。年度間の改称、分割、統合、
比較上の同等関係は分類IDへ暗黙に寄せず、`fiscal_classification_mappings`と
そのrevision・member・根拠へ記録する。議案リンクにも資料内出現と版別根拠を持たせ、
候補生成後の手動確定を取得版まで追跡できるようにする。

## 公開とアクセス

財政テーブルはすべてRLSを有効にし、ポリシーを定義しない。公開・管理アクセスは
既存方針どおりサーバー側の`createAdminClient()`を経由する。

parser根拠を公開する後続PRでは、共通registryのconsumer type
`fiscal_data`を使用し、保持中の非公開原本にだけactive referenceを作る。
根拠完全性とregistry同期のguardが入るまでは、財政の各revisionを`published`へ
遷移させる操作をDB triggerでfail closedにする。
複数出典の必須ロールと別出典性を検証するguardが入るまでは、`cross_source`検算の
作成もfail closedにする。

## 後続PR

1. publication guard、制御された状態遷移、source registry同期を完成させる。
2. 令和6年度決算・主要施策報告と令和8年度予算概要のstaging/parserを追加する。
3. 検算・人手QAを経て初期基準値を投入する。
4. 公開repository/APIと表中心の`/finance`を追加する。
5. 議案詳細との双方向リンク、グラフ、アクセシビリティE2Eを追加する。
