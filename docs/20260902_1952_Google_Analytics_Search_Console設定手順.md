# Google Analytics / Search Console 設定手順

## 対象

- 公開サイト: `https://mirai-numazu.com`
- Google Analytics: GA4
- Search Console: ドメインプロパティ

## 1. Google Analytics 4

1. [Google Analytics](https://analytics.google.com/) でアカウントとGA4プロパティを作成する。
2. ウェブデータストリームを次の内容で作成する。
   - ウェブサイトURL: `https://mirai-numazu.com`
   - ストリーム名: `みらい議会＠沼津市`
3. ストリーム詳細に表示される `G-` から始まる測定IDを控える。
4. Vercelのwebプロジェクトで、Production環境に次の環境変数を追加する。

   ```text
   NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX
   ```

5. `main` のデプロイを再実行する。測定IDは公開ビルド時に埋め込まれるため、環境変数を追加しただけでは既存デプロイに反映されない。
6. 公開サイトを開き、GA4のリアルタイムレポートでページ表示を確認する。

本サービスではページ表示に加え、次の既存カスタムイベントを送信する。

- `difficulty_state`: 説明の詳しさ
- `furigana_state`: ふりがな表示の状態

測定IDが未設定の場合、Google Analyticsのスクリプトは読み込まれない。

## 2. Google Search Console

1. [Google Search Console](https://search.google.com/search-console) でプロパティを追加する。
2. 種別は「ドメイン」を選び、`mirai-numazu.com` と入力する。
3. Search Consoleに表示されたTXTレコードを、ドメインのDNS設定へ追加する。
4. DNS反映後にSearch Consoleで「確認」を実行する。
5. 確認後も所有権を維持するため、TXTレコードは削除しない。
6. 「サイトマップ」から次を送信する。

   ```text
   https://mirai-numazu.com/sitemap.xml
   ```

ドメインプロパティは、`https` / `http` と `www` を含むサブドメインをまとめて対象にする。所有権確認はDNSで行うため、HTMLメタタグ用の環境変数は不要。

## 3. 公開後の確認

- `https://mirai-numazu.com/robots.txt` が200を返し、サイトマップURLを含む
- `https://mirai-numazu.com/sitemap.xml` が200を返し、URLが `https://mirai-numazu.com` で始まる
- ページHTMLに設定したGA4測定IDが含まれる
- GA4リアルタイムレポートに自分のアクセスが表示される
- Search Consoleのサイトマップ状態が「成功しました」になる

Search Consoleへのサイトマップ送信はクロールの手掛かりであり、すべてのURLの登録を保証するものではない。公開後は「ページのインデックス登録」と「検索パフォーマンス」を定期的に確認する。
