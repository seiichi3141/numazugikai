---
name: land
description:
  PR をランディングする。コンフリクトを監視・解決し、チェックを待ち、グリーンに
  なったら用途に合う方式で merge する。land、merge、PR を完了まで導くことを依頼された
  ときに使用する。
---

# Land

## ゴール

- PR が対象 base branch とコンフリクトフリーであることを確実にする。
- CI をグリーンに保ち、失敗が発生したときは修正する。
- 通常の feature PR は squash-merge する。
- `develop` から `main` への release PR と、履歴保存を明示した PR は merge commit
  で取り込み、長期 lifecycle branch と移植元コミットの履歴を保持する。
- PR がマージされるまでユーザーに譲らない。ブロックされない限りウォッチャーループを実行し続ける。
- マージコマンドでは head branch を削除しない。短期 branch の後片付けはマージ確認後に
  別途行い、lifecycle branch は必ず保持する。

## 前提条件

- `gh` CLI が認証されている。
- PR ブランチ上にいて、作業ツリーがクリーン。

## 手順

1. 現在のブランチに対する PR を特定する。
2. push 前にすべての関門がローカルでグリーンであることを確認する。
3. 作業ツリーに未コミットの変更がある場合、進める前に `commit` スキルでコミットし `push` スキルで push する。
4. PR の `baseRefName` に対するマージ可能性とコンフリクトを確認する。
5. コンフリクトがある場合、`pull` スキルを使って対象 base branch を
   fetch／merge してコンフリクトを解決し、その後 `push` スキルを使って
   更新されたブランチを公開する。
6. マージ前に Codex のレビューコメント（存在する場合）が確認され、必要な修正が処理されていることを確認する。
7. 完了までチェックを監視する。
8. チェックが失敗した場合、ログを取得し、問題を修正し、`commit` スキルでコミット、`push` スキルで push し、チェックを再実行する。
9. すべてのチェックがグリーンでレビューフィードバックが対処されたら、PR の
   base/head/label からマージ方式を決める。通常は squash、同じ自治体の
   `develop` → `main`、または `preserve-history` label 付き PR は merge commit を使う。
   `develop` / `main` と `sites/<site>/{develop,main}` は削除しない。
10. **コンテキストガード:** レビューフィードバックを実装する前に、それがユーザーの述べた意図やタスクコンテキストと矛盾しないことを確認する。矛盾する場合は、根拠を添えてインラインで返信し、コードを変更する前にユーザーに確認する。
11. **プッシュバックテンプレート:** 同意しないときは、認知 + 根拠 + 代替案の提示でインライン返信する。
12. **曖昧性ゲート:** 曖昧性が進捗をブロックする場合、明確化フロー（PR を現在の GH ユーザーにアサインし、メンションし、応答を待つ）を使用する。曖昧性が解決するまで実装しない。
    - レビュアーよりも自分の方が正しいと確信している場合は、ユーザーに確認せずに進めてもよいが、根拠を添えてインライン返信する。
13. **コメントごとモード:** 各レビューコメントに対して、accept、clarify、push back のいずれかを選ぶ。コードを変更する前にモードを述べてインライン（または Codex レビューの場合は issue スレッド）に返信する。
14. **変更前に返信:** コード変更を push する前に、常に意図したアクションで応答する（レビューコメントにはインラインで、Codex レビューには issue スレッドで）。

## コマンド

```
# ブランチと PR コンテキストを確認
branch=$(git branch --show-current)
pr_number=$(gh pr view --repo seiichi3141/numazugikai --json number -q .number)
pr_title=$(gh pr view --repo seiichi3141/numazugikai --json title -q .title)
pr_body=$(gh pr view --repo seiichi3141/numazugikai --json body -q .body)
base=$(gh pr view --repo seiichi3141/numazugikai --json baseRefName -q .baseRefName)
head=$(gh pr view --repo seiichi3141/numazugikai --json headRefName -q .headRefName)
preserve_history=$(gh pr view --repo seiichi3141/numazugikai --json labels \
  --jq 'any(.labels[]; .name == "preserve-history")')

# マージ可能性とコンフリクトを確認
mergeable=$(gh pr view --repo seiichi3141/numazugikai --json mergeable -q .mergeable)

if [ "$mergeable" = "CONFLICTING" ]; then
  # `pull` スキルを実行して fetch + merge + コンフリクト解決を処理する。
  # その後 `push` スキルを実行して更新されたブランチを公開する。
fi

# 推奨: 下記の Async Watch Helper を使う。手動ループは Python が動かないか
# ヘルパースクリプトが利用できないときのフォールバック。
# レビューフィードバックを待つ: Codex レビューは "## Codex Review — <persona>" で
# 始まる issue コメントとして到着する。レビュアーフィードバックと同様に扱い、
# 発見事項を確認したことと、対応するか延期するかを示す `[codex]` issue コメントで
# 返信する。
while true; do
  gh api repos/{owner}/{repo}/issues/"$pr_number"/comments \
    --jq '.[] | select(.body | startswith("## Codex Review")) | .id' | rg -q '.' \
    && break
  sleep 10
done

# チェックを監視
if ! gh pr checks --repo seiichi3141/numazugikai --watch; then
  gh pr checks --repo seiichi3141/numazugikai
  # 失敗した run を特定してログを検査
  # gh run list --branch "$branch"
  # gh run view <run-id> --log
  exit 1
fi

# lifecycle release または履歴保存PRは merge commit、それ以外は squash。
merge_commit=false
if [ "$base" = "main" ] && [ "$head" = "develop" ]; then
  merge_commit=true
else
  case "$base" in
    sites/*/main)
      site=${base#sites/}
      site=${site%/main}
      if [ "$head" = "sites/$site/develop" ]; then
        merge_commit=true
      fi
      ;;
  esac
fi

if [ "$merge_commit" = true ] || [ "$preserve_history" = true ]; then
  gh pr merge --repo seiichi3141/numazugikai --merge \
    --subject "$pr_title" --body "$pr_body"
else
  gh pr merge --repo seiichi3141/numazugikai --squash \
    --subject "$pr_title" --body "$pr_body"
fi
```

## Async Watch Helper

推奨: asyncio ウォッチャーを使ってレビューコメント、CI、head 更新を並列に監視する:

```
python3 .agents/skills/land/land_watch.py
```

終了コード:

- 2: レビューコメントが検出された（フィードバックに対応せよ）
- 3: CI チェックが失敗した
- 4: PR の head が更新された（autofix コミットが検出された）

## 失敗ハンドリング

- チェックが失敗した場合、`gh pr checks` と `gh run view --log` で詳細を取得し、ローカルで修正、`commit` スキルでコミット、`push` スキルで push し、ウォッチを再実行する。
- 不安定な失敗（flaky）を判別する判断力を使う。失敗が flake（例: 1 プラットフォームのみのタイムアウト）であれば、修正せずに進めてもよい。
- CI が autofix コミット（GitHub Actions が author）を push した場合、それは新しい CI run をトリガしない。更新された PR head を検出し、ローカルに pull し、必要なら対象 base branch をマージし、本物の author コミットを追加し、CI を再トリガするために force-push し、その後チェックループを再開する。
- マージコミット上で全ジョブが pnpm lockfile 破損エラーで失敗する場合、最新の対象 base branch を fetch、マージ、force-push、CI 再実行が修復策。
- `preserve-history` は独立リポジトリから既存コミットを移植する PR など、元の commit
  SHA を target branch に残す必要がある場合だけ付ける。
- マージ可能性が `UNKNOWN` の場合、待って再確認する。
- レビューコメント（人間または Codex レビュー）が未対応のままマージしない。
- Codex レビュージョブは失敗時にリトライされ、ノンブロッキングである。レビューフィードバックが利用可能になったシグナルとしては、ジョブの状態ではなく、`## Codex Review — <persona>` issue コメントの存在を使う。
- auto-merge を有効にしない。このリポジトリには必須チェックがないため、auto-merge はテストをスキップしうる。
- 自分自身の以前の force-push やマージのためにリモート PR ブランチが先行している場合、冗長なマージを避け、必要ならローカルでフォーマッタを再実行し、`git push --force-with-lease` する。

## レビューハンドリング

- Codex レビューは現在 GitHub Actions が投稿する issue コメントとして到着する。`## Codex Review — <persona>` で始まり、レビュアーの方法論 + 使用したガードレールを含む。マージ前に確認しなければならないフィードバックとして扱う。
- 人間のレビューコメントはブロッキングであり、新しいレビューを要求する前またはマージ前に対処（応答して解決）しなければならない。
- 同じスレッドに複数のレビュアーがコメントしている場合、スレッドを閉じる前に各コメントに応答する（バッチで応答してよい）。
- `gh api` でレビューコメントを fetch し、プレフィックス付きのコメントで返信する。
- インラインフィードバックを見つけるためには review comment エンドポイント（issue comments ではなく）を使う:
  - PR レビューコメントの一覧:
    ```
    gh api repos/{owner}/{repo}/pulls/<pr_number>/comments
    ```
  - PR issue コメント（トップレベルのディスカッション）:
    ```
    gh api repos/{owner}/{repo}/issues/<pr_number>/comments
    ```
  - 特定のレビューコメントへの返信:
    ```
    gh api -X POST /repos/{owner}/{repo}/pulls/<pr_number>/comments \
      -f body='[codex] <response>' -F in_reply_to=<comment_id>
    ```
- `in_reply_to` は数値の review comment id（例: `2710521800`）でなければならず、GraphQL ノード id（例: `PRRC_...`）ではない。エンドポイントには PR 番号（`/pulls/<pr_number>/comments`）を含めなければならない。
- GraphQL のレビュー返信 mutation が禁止されている場合、REST を使う。
- 返信での 404 は通常、誤ったエンドポイント（PR 番号の欠落）または不十分なスコープを意味する。最初にコメントを一覧表示して確認する。
- このエージェントが生成するすべての GitHub コメントには `[codex]` プレフィックスを付ける。
- Codex レビュー issue コメントについては、（レビュースレッドではなく）issue スレッドで `[codex]` 付きで返信し、フィードバックに今すぐ対応するか延期するかを述べる（根拠を含める）。
- フィードバックが変更を必要とする場合:
  - インラインレビューコメント（人間）には、意図する修正で `[codex] ...` として返信する。**review comment エンドポイントと `in_reply_to` を使い、元のレビューコメントへのインライン返信として行う**（issue コメントを使わない）。
  - 修正を実装、コミット、push する。
  - 修正の詳細とコミット sha で `[codex] ...` として、フィードバックを認知したのと同じ場所に返信する（Codex レビューには issue コメント、レビューコメントにはインライン返信）。
  - land ウォッチャーは、発見事項を認知する新しい `[codex]` issue コメントが投稿されるまで、Codex レビュー issue コメントを未解決として扱う。
- 新しい Codex レビューを要求するのは再実行が必要なとき（例: 新しいコミット後）のみ。前回のレビュー以降変更がないのに要求しない。
  - 新しい Codex レビューを要求する前に、land ウォッチャーを再実行し、未対応のレビューコメントがゼロ（すべてに `[codex]` インライン返信がある）であることを確認する。
  - 新しいコミットを push した後、Codex レビューワークフローは PR 同期で再実行される（または手動でワークフローを再実行できる）。レビュアーが最新の差分を把握できるよう、簡潔なルートレベルのサマリコメントを投稿する:
    ```
    [codex] 前回のレビュー以降の変更:
    - <差分の短い箇条書き>
    Commits: <sha>, <sha>
    Tests: <実行したコマンド>
    ```
  - 前回の要求以降に少なくとも 1 つの新しいコミットがある場合のみ、新しいレビューを要求する。
  - マージ前に次の Codex レビューコメントを待つ。

## スコープ + PR メタデータ

- PR タイトルと説明は、最新の修正だけでなく、変更の全スコープを反映する必要がある。
- レビューフィードバックでスコープが拡大した場合、今含めるか後回しにするかを決定する。フィードバックは accept、defer、decline のいずれかにできる。defer または decline する場合は、ルートレベルの `[codex]` 更新で簡潔な理由（例: out-of-scope、意図と矛盾、不要）を呼び出す。
- レビューコメントで提起された correctness の問題には対処すべき。correctness の懸念を defer または decline する予定なら、まず検証し、なぜその懸念が当てはまらないかを説明する。
- 各レビューコメントを以下のいずれかに分類する: correctness、design、style、clarification、scope。
- correctness フィードバックには、クローズする前に具体的な検証（テスト、ログ、または推論）を提供する。
- フィードバックを受け入れるとき、ルートレベル更新に 1 行の根拠を含める。
- フィードバックを断るとき、簡潔な代替案またはフォローアップトリガを提示する。
- 多くの小さな更新ではなく、修正のバッチ後に単一の統合された "review addressed" ルートレベルコメントを優先する。
- ドキュメントフィードバックについては、ドキュメント変更が挙動と一致することを確認する（レビューを宥めるためのドキュメントのみの編集はしない）。
