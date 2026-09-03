# Repository Guidelines

> **Note**: `CLAUDE.md` は `AGENTS.md` へのシンボリックリンクです。ルールの追加・編集は必ず `AGENTS.md` を直接編集してください。

## 必須ルール

### Worktree必須
変更作業は、**必ず git worktree を作成してから開始すること**。メインのリポジトリディレクトリでは直接変更を行わない。

```bash
# 1. 対象自治体の develop から worktree を作成
git worktree add ../numazugikai-<worktree-name> \
  -b <feature-branch> <base-branch>

# 2. settings.local.jsonをコピー（権限設定のため必須）
mkdir -p ../numazugikai-<worktree-name>/.claude
cp .claude/settings.local.json ../numazugikai-<worktree-name>/.claude/

# 3. 対象 branch の雛形から .env を作成
cp ../numazugikai-<worktree-name>/.env.example \
  ../numazugikai-<worktree-name>/.env

# 4. 依存パッケージをインストール
cd ../numazugikai-<worktree-name> && pnpm install --frozen-lockfile
```

- **base branch を明示する**: 沼津市の既存開発は `develop`、自治体別開発は
  `sites/<site>/develop` から分岐する。hotfix だけは対応する `main` から分岐する。
  省略すると現在の HEAD から分岐し、別の自治体のコミットが PR に混入する原因になる。
- **自治体間で `.env` をコピーしない**: 対象 branch の `.env.example` から作り、
  必要な値だけを設定する。同じ自治体の既存 worktree から引き継ぐ場合も、接続先を
  確認してから使う。
- branch 名と PR の向き先は
  [複数自治体ブランチ運用方針](docs/20260903_1906_複数自治体ブランチ運用方針.md)
  に従う。

- **目的**: 各 develop branch を常にクリーンに保ち、作業の分離と並列作業を容易にする
- **base branch に変更が残っている場合のリカバリ**: worktreeを作成する前に、base branch の変更を必ずクリーンアップすること。作業途中の変更をbase branchに残したままworktreeを作成・作業することは禁止。
  ```bash
  # 変更を退避してから、base branch を明示して worktree を作成
  git stash --include-untracked
  git worktree add ../numazugikai-<worktree-name> \
    -b <feature-branch> <base-branch>
  # worktreeに移動して退避した変更を適用
  cd ../numazugikai-<worktree-name>
  git stash pop
  ```

### リモート操作の安全ルール

- `origin` は必ず `seiichi3141/numazugikai` を指すこと。
- `upstream` は `team-mirai/mirai-gikai` の参照専用 remote とし、push URL は
  `DISABLED_DO_NOT_PUSH` を維持すること。
- GitHub への書き込み操作は `--repo seiichi3141/numazugikai` を明示する。
- PR 作成時は `--base` に通常開発では対象自治体の develop、hotfix では同じ
  自治体の main を明示する。
- upstream の更新は専用 branch で fetch し、自治体ごとに個別の PR で取り込む。

### 実装完了後は即PR作成
実装完了後は「コミットしますか？」等の確認を挟まず、コミット → push → PR作成まで一気に進めること。ユーザーへの確認は不要。

### セルフレビュー必須
実装完了後（コミット前）に、以下の順で必ずセルフレビューを実施すること：

1. **`/simplify` を実行**: 変更コードの重複・可読性・効率の観点から自己修正を行う。明らかな問題を先に潰しておくことで、後段の `/review` の指摘ノイズを減らす。
2. **`/review` を実行**: Codexレビュー・`test-guidelines-checker` によるテストガイドラインチェック・`code-quality-checker` によるコード品質チェックを同時に実行する。指摘があれば修正する。

両方を通過したら、ユーザーに確認せずそのままコミット → push → PR作成まで一気に進めること（`gh pr create`）。

### UI変更時のスクリーンショット必須
PR作成後、変更差分にUI関連ファイル（`web/src/`, `admin/src/` 配下の `.tsx`, `.css` 等）が含まれる場合は、必ず `/pr-screenshot` スキルを実行すること。スキルが自動でdevサーバー起動→スクリーンショット撮影→R2アップロード→PR本文更新まで行う。

### 並列PR作成
複数の独立したPRを作成する場合は `/parallel-pr` スキルを使用すること。

### Linearタスクのステータス管理
Linear issue ID（例: `MIR-123`）を含むタスクを依頼された場合、以下のタイミングで `/linear` スキルを実行すること：
- **作業着手時**: `/linear start <issue-id>` でステータスを `In Progress` に更新
- **PR作成後**: `/linear review <issue-id>` でステータスを `In Review` に更新し、PR URLをissueにリンク

## Project Structure & Module Organization
- `web/` は公開用 Next.js アプリ。共通 UI は `src/components`、Vitest のテストは `src/**/*.test.ts` に配置します。
- `admin/` はポート 3001 で動く管理用 Next.js。審議フローやダッシュボードはここに集約します。
- `packages/supabase/` は共有 Supabase クライアントと型定義を提供し、生成結果は `types/` に保存します。
- `packages/shared/` は `web` と `admin` の両方で使う共通ロジック（AI モデル定義、ストリーム処理等）を提供します。
- `packages/seed/` はローカルデータ投入用の TypeScript スクリプト (`run.ts`, `data.ts`) を管理します。
- `supabase/` はマイグレーションと設定ファイルを保持します。
- 設計ドキュメントは `docs/` に格納し、ルートの設定ファイル（`biome.json`, `pnpm-workspace.yaml` など）は全体ポリシーとして扱います。
- **web と admin でのコード共有**: 同一ロジックを `web/` と `admin/` の両方で使う場合は、`packages/` 配下の workspace パッケージに切り出すこと。同じコードを両アプリに重複配置するのは禁止。既存の `@mirai-gikai/shared` パッケージに追加するか、用途に応じて新しいパッケージを作成する。

## Next.js アーキテクチャ指針
- Bulletproof React の feature ベース構成を採用します。
- `app/` 配下の `page.tsx` は、URL パラメータ（`params` や `searchParams`）の取得と Feature コンポーネントへの受け渡しのみを担当する薄いラッパーとし、ビューやロジックは `features/` 配下に実装します。
- export 用の `index.ts` は作成せず、必要なファイルから直接 import します。
- Server Components を標準とし、状態管理・イベント処理が必要な場合のみ `"use client"` を付与した Client Component を追加します。
- ファイル名はケバブケース、コンポーネントはパスカルケース、関数はキャメルケースで統一します。

### Feature ディレクトリ構造
複雑な feature では server/client/shared の3層構造を採用します：

```
src/features/{feature}/
├── server/
│   ├── repositories/  # データアクセス層（Supabase呼び出しを集約）
│   ├── components/    # Server Components
│   ├── loaders/       # Server Components用データ取得関数
│   ├── actions/       # Server Actions ("use server")
│   ├── services/      # ビジネスロジック層
│   └── utils/         # Server専用ユーティリティ
├── client/
│   ├── components/    # Client Components（Server/Client両方で使えるものも含む）
│   ├── hooks/         # カスタムフック
│   └── utils/         # Client専用ユーティリティ
└── shared/
    ├── types/         # 共通型定義
    └── utils/         # 共通ユーティリティ
```

`web/` と `admin/` の両方で同じ server/client/shared 構成を採用します。ただし `admin/` では Server Components が中心のため `client/` ディレクトリを省略している feature もあります。

- Server側ファイルには `"server-only"` を、Client Componentsには `"use client"` を付与
- 型定義やServer/Client両方で使う関数は `shared/` に配置
- **純粋関数の切り出し**: 新規実装時、外部依存（DB・API・認証等）を持たない計算・変換・判定ロジックは純粋関数として `utils/` に切り出すこと。配置先は用途に応じて `shared/utils/`、`server/utils/`、`client/utils/` を選択する。
- シンプルな feature は従来の `components|actions|api|types` 構成でも可

Repository レイヤーの詳細は [docs/repository-layer.md](docs/repository-layer.md) を参照。

## Build, Test, and Development Commands
- 依存導入は `pnpm install`、全てのスクリプトは pnpm 経由で実行します。
- `pnpm dev` は `.env` を共有しつつ `web`・`admin`・各パッケージの dev サーバーを並列起動します。
- `pnpm test` でワークスペース横断の Vitest を実行。局所実行は `pnpm --filter web test` や `test:watch` を利用します。
- 品質ゲートとして `pnpm lint`（Biome format+lint）と `pnpm typecheck` を PR 前に通過させます。
- DB 関連は `pnpm db:reset`、`pnpm db:migrate`、`pnpm db:types:gen`、`pnpm seed` を用途に応じて組み合わせます。

## 沼津市議会向けの用語ルール（必須）

この節は `develop` / `main` と、`sites/` で始まらない既存の沼津市向け
feature branch に適用する。自治体別 branch では、その branch の `AGENTS.md` に
記載された用語ルールを優先する。

本リポジトリは本家「みらい議会」（国会向け）の fork で、**沼津市議会向け**に改修している。
UI文言・コメント・プロンプトを書くときは次の語を使うこと。

| 使わない（本家＝国会） | 使う（本サービス＝沼津市議会） |
| :-- | :-- |
| 国会 | 沼津市議会 / 市議会 |
| 法案 | 議案（条例改正は「条例案」、予算は「予算案」） |
| 衆議院 / 参議院 | （一院制のため概念なし） |
| 法案成立 | 可決 |
| 国会議員 | 市議会議員 |
| 国会会期 | 会期（定例会・臨時会） |
| チームみらい | （使わない） |

- サービス名は **みらい議会＠沼津市**
- 審議の流れは「議案提出 → 委員会付託 → 委員会審査 → 本会議議決」の一段階
- 常任委員会は 総務経済 / 民生病院教育 / 建設水道危機管理 / 一般会計予算決算
- 定例会は年4回（2月・6月・9月・11月）
- **本サービスは沼津市および沼津市議会の公式サービスではない**。その旨が伝わる表現を保つこと
- チームみらいのロゴ・タイポグラフィ・商標は使用禁止（AGPL-3.0 第7条 / FORK_GUIDELINES）。
  免責文言「これは政党チームみらいが運営しているものではありません」をフッターに保持すること
- 議員数・会派構成など変動する数字を文言に直書きしないこと

詳細は [docs/20260901_2220_沼津市向けブランディング対応状況.md](docs/20260901_2220_沼津市向けブランディング対応状況.md) を参照。

## Coding Style & Naming Conventions
- Biome が 2 スペースインデント、LF、ダブルクォート、セミコロン、80 文字幅を強制します。
- React コンポーネントと公開型は PascalCase、フックやユーティリティは camelCase を維持します。
- ファイル名は `bill-contents-data.ts` のようにローワーハイフンで表記し、スタイルは Tailwind ユーティリティを先に検討します。
- **アイコン**: インラインSVGは禁止です。必ず `lucide-react` からアイコンコンポーネントをインポートして使用してください。
- **ボタン**: `<button>` タグの使用は禁止です。必ず `@/components/ui/button` の `Button` コンポーネントを使用してください。
- **色**: インラインカラーコード（`text-[#xxx]`, `bg-[#xxx]`, `border-[#xxx]` 等の arbitrary value や style 属性での直接指定）は**禁止**です。必ず `globals.css` の `@theme inline` で定義済みのカラートークン（`text-mirai-text`, `bg-primary`, `border-primary-accent` 等）を使用してください。新しい色が必要な場合は、まず `globals.css` にトークンを追加してから使用すること。既存トークン一覧は `web/src/app/globals.css` の `@theme inline` ブロックを参照。
- **Figma実装**: FigmaのURLからUIを実装する際、スクリーンショットだけで色やサイズを推測しないこと。必ず `get_variable_defs` や `get_design_context` でカラーコード・フォントサイズ・スペーシング等の正確な値を取得し、既存のデザイントークンとの対応を確認してから実装する。

### admin 内部ルート定義
- admin アプリの内部リンク（Link href, router.push, redirect）には `@/lib/routes` の関数を使用すること。文字列リテラルでのルート直書きは禁止。
- 新しいページ（page.tsx）を追加したら `admin/src/lib/routes.ts` にもルート関数を追加すること。テスト（routes.test.ts）が page.tsx との同期を検証する。

### web 内部ルート定義
- web アプリの内部リンク（Link href, router.push, redirect, revalidatePath）には `@/lib/routes` の関数を使用すること。文字列リテラルでのルート直書きは禁止。
- 新しいページ（page.tsx）を追加したら `web/src/lib/routes.ts` にもルート関数を追加すること。テスト（routes.test.ts）が page.tsx との同期を検証する。
- preview 付きリンク生成は `interview-links.ts` のラッパー関数を使用すること。

## Testing Guidelines
- Vitest の単体テストを `*.test.ts` として実装と同階層に配置し、AI コスト計算や Markdown 処理などデータ変換の変更時は必ず回帰テストを追加します。
- **純粋関数にはテスト必須**: `utils/` に切り出した純粋関数は、新規作成時に必ず `*.test.ts` を同階層に作成してテストを書いてください。
- **mock は極力使わない**: `vi.mock("server-only")` 等のモックに頼らず、テスト対象のロジックを純粋関数として `shared/` に切り出してからテストしてください。`server-only` や外部依存を含むファイルからは re-export で参照を維持します。
- **ローカルサービスは real で動かす**: Supabase などローカルで起動できるサービスはモックせず、実際のローカルインスタンスに接続してテストします。
- **DB function（RPC）には統合テスト必須**: `supabase/migrations/` でDB function を追加・変更した場合、`tests/supabase/db-function/` に統合テストを作成すること。テストファイル名は `{function-name}.test.ts` とし、`tests/supabase/utils.ts` のヘルパーを利用する。ソート・フィルタ・集計ロジックがDB側にある場合、アプリ層のユニットテストでは検出できないバグ（例: フルテーブルスキャン、不正なソート順）を防止できます。
- **外部 API は DI でモックする**: OpenAI などの外部 API クライアントはインターフェースを定義し、テストでは Fake/Mock 実装に差し替えます。
- PR 前に `pnpm --filter web test:watch` で失敗を早期検知し、必要に応じて `vitest run --coverage` でカバレッジ低下を確認します。
- テストの書き方・構造化・コード例などの詳細は [docs/テストガイドライン.md](docs/20260219_1000_テストガイドライン.md) を参照。

## Commit & Pull Request Guidelines
- **push前のローカル検証（必須）**: `git push` の前に、CIと同じ検証コマンドをローカルで実行して通過を確認すること。CIで落ちてから直すのではなく、手元で事前に検知する。
  ```bash
  pnpm lint        # Biome format + lint チェック
  pnpm typecheck   # TypeScript 型チェック
  pnpm build       # Next.js ビルドチェック
  pnpm test        # 全ワークスペースのテスト実行
  ```
- **push / PR作成前のGitHub状態確認（必須）**: `git push` やPR作成を行う前に、必ず `gh pr list` や `gh pr view <番号>` でGitHub上のPR状態（open/merged/closed）を確認すること。マージ済みブランチへの追加pushや、既にクローズされたPRとの重複を防ぐ。
- **PRのスコープを厳守**: PRには現在のタスクに関係する変更のみを含めること。レビューやセルフレビューで無関係な変更（別タスクの修正、ついでのリファクタ等）が混入していた場合は、コミット前に取り除く。
- コミットメッセージは既存履歴同様、短い命令形主体（日本語可）とし、課題連携は `(#id)` を付与します。
- PR ではスコープ概要、実行テスト記録（例: `pnpm dev`, `pnpm --filter web test`）、UI 変更時のスクリーンショットや GIF を添付します。
- スキーマ・シード・環境変数の変更は本文で明示し、レビューフィードバックへの対応状況を追跡コメントで共有して Ready for Review に切り替えます。
- **イシュー連携**: `develop`（GitHub の default branch）宛ての PR は、本文に
  `Resolves #123` と記載してマージ時に自動クローズできる。自治体別 branch 宛ての
  PR では closing keyword が自動適用されないため、Development 欄または本文で
  issue をリンクし、マージ確認後に issue を別途クローズする。
- **PR作成後の状態確認（必須）**: PR作成後、以下の4点を確認すること：
  1. **Conflict確認**: `gh pr view <番号> --json mergeable,mergeStateStatus` でマージ可能か確認。conflictがあれば解消してpushする。
  2. **CI確認**: `gh pr checks <番号>` でCIの状態を確認。失敗があれば原因を調査し修正してpushする。CIが実行中の場合は完了まで待つ。
  3. **CodeRabbitレビュー確認**: CodeRabbitのレビューが届くまで待ってからコメントを確認する。レビューは通常2〜3分で届く。`gh api repos/{owner}/{repo}/pulls/{number}/comments` でコメントを取得し、空なら少し待って再取得する。**Minor以上（Minor/Major/Critical）の指摘はすべて対応が必須。** 対応とは「修正してpush」または「スキップ理由を該当コメントに返信」のいずれか。Nitpickのみスキップ可。
  4. **対応済みコメントへの返信とresolve（必須）**: 対応済みコメント（修正pushした場合・スキップした場合の両方）に対して、該当コメントへ返信した上でGraphQL APIでresolveする。返信なしで黙ってresolveするのは禁止。
     ```bash
     # 1. 該当コメントに返信（対応内容の概要を記載、修正の場合はコミットSHAを含める）
     gh api repos/{owner}/{repo}/pulls/{number}/comments -X POST \
       -F in_reply_to=<コメントID> \
       -f body='修正しました (<コミットSHA>)。<対応内容の要約>'
     # 2. スレッド一覧取得（isResolved=falseのものが未resolve）
     gh api graphql -f query='{ repository(owner: "{owner}", name: "{repo}") { pullRequest(number: <番号>) { reviewThreads(first: 50) { nodes { id isResolved comments(first: 1) { nodes { body path } } } } } } }'
     # 3. 対応済みスレッドをresolve
     gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<スレッドID>"}) { thread { isResolved } } }'
     ```

## Supabase & Environment Notes
- ローカル開発前に `npx supabase start` を実行し、`.env.example` を `.env` にコピーして値を整えます。
- スキーマ変更時は `supabase/migrations` のマイグレーションと `packages/supabase/types/supabase.types.ts` の再生成ファイルをセットでコミットします。
- `pnpm seed` は `admin@example.com / admin123456` を含む検証データを投入するため、開発用途に限定してください。
- **RLSとアクセスパターン**: マイグレーションでは必ず `alter table <テーブル名> enable row level security;` を記述してRLSを有効化すること。ただし **ポリシーは定義しない**（デフォルト全拒否）。データアクセスはすべて `createAdminClient()`（Supabase Secret Key）経由で行い、認可ロジックはアプリケーション層（Server Actions / Loaders）で実装する。

## ドキュメント作成ルール
- 要件定義や実装計画をまとめる際は論点を先に洗い出し、不明点を確認してから Markdown で整理します。
- 設計文書は `docs/` 配下に `YYYYMMDD_HHMM_作業内容.md` で保存してください（例: `docs/20250815_1430_ユーザー認証システム設計.md`）。
- 既存資料に大きな変更を加える場合は新しいファイルとして残し、更新履歴をたどれるようにします。

## GitHub Issue作成ルール
GitHub Issueを作成する際は、以下のルールに従うこと：

- プラン内容を簡略化せず、そのままissueに記載する
- コード例、SQL、型定義などの詳細な実装内容を含める
- 検証方法を具体的に記載する
