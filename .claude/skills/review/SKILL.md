---
name: review
description: コードレビュー・テストガイドラインチェック・コード品質チェックを同時実行する
---

# Review

コードレビュー・テストガイドラインチェック・コード品質チェックを**並列に実行**するセルフレビュースキル。

## 使い方

引数なしで実行すると、PR の base（未作成なら branch 名から推定した自治体別
develop、hotfix は main）との差分をレビューする。

```
/review
/review "セキュリティ面を重点的にチェックして"
```

## ワークフロー

### Step 1: 差分の確認

まず現在のブランチと変更内容を確認する:

```bash
CURRENT_BRANCH=$(git branch --show-current)
BASE_BRANCH=$(gh pr view --repo seiichi3141/numazugikai \
  --json baseRefName --jq .baseRefName 2>/dev/null || true)
if [ -z "$BASE_BRANCH" ]; then
  BASE_BRANCH=$(node scripts/resolve-branch-base.mjs "$CURRENT_BRANCH")
fi
git diff --stat "$BASE_BRANCH"...HEAD
```

変更がない場合（かつ未コミット変更もない場合）はユーザーに通知して終了。
未コミット変更がある場合は `git diff --stat` で確認する。

### Step 2: 3つのチェックをサブエージェントで並列実行

以下の3つを **サブエージェントで並列に** 起動する:

#### 2a. Codex Review（オプション）

`codex` CLI が利用可能な場合のみ実行する。ユーザーから追加の指示（引数）があれば PROMPT として渡す。

```bash
which codex 2>/dev/null && codex review --base "$BASE_BRANCH"
```

`codex` が見つからない場合はこのチェックをスキップする。

#### 2b. テストガイドラインチェック

`.claude/agents/test-guidelines-checker.md` の内容に従い、サブエージェントを起動してテストガイドラインの遵守状況をチェックする。

#### 2c. コード品質チェック

`.claude/agents/code-quality-checker.md` の内容に従い、サブエージェントを起動して可読性・保守性・コード品質をチェックする。

**重要**: 2a, 2b, 2c は必ず並列（サブエージェント）で実行すること。

### Step 3: 結果の報告

3つの結果をまとめてユーザーに表示する:

1. **Codex Review 結果**（実行した場合）: Codex の出力をそのまま表示
2. **テストガイドラインチェック結果**: サブエージェントの出力をそのまま表示
3. **コード品質チェック結果**: サブエージェントの出力をそのまま表示

## 注意事項

- レビュー対象はデフォルトで PR の対象 base branch との差分
- エージェント定義ファイルが存在しない場合は、該当チェックをスキップして残りを実行する
