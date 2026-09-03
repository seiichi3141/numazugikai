#!/bin/bash
# PRに無関係なコミットが混入するのを防ぐため、
# git push 前にブランチのコミットが他ブランチ由来でないか検証する。
#
# 検出ロジック: 対象自治体の base..HEAD のコミットが、自ブランチ・base
# 以外のリモートブランチにも存在する場合、別ブランチから分岐した可能性がある。

set -euo pipefail

BRANCH=$(git branch --show-current 2>/dev/null || true)
REPO_ROOT=$(git rev-parse --show-toplevel)

# lifecycle branch 自体への push は検証不要。完全一致の共通判定を使い、
# sites/<site>/feat/main のような短期 branch を誤って除外しない。
if node "$REPO_ROOT/scripts/is-lifecycle-branch.mjs" "$BRANCH"; then
  exit 0
fi

# push / pull / review と同じ共通 resolver を使う。
BASE_BRANCH=$(node "$REPO_ROOT/scripts/resolve-branch-base.mjs" "$BRANCH")

BASE_REF="origin/$BASE_BRANCH"
if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "BLOCKED: 必要な base ref '$BASE_REF' がありません。" >&2
  echo "git fetch origin '$BASE_BRANCH:refs/remotes/origin/$BASE_BRANCH' を実行してください。" >&2
  exit 2
fi

# 対象 base に無い（= このブランチ独自の）コミット一覧
COMMITS=$(git rev-list "$BASE_REF"..HEAD 2>/dev/null || true)
if [ -z "$COMMITS" ]; then
  exit 0
fi

FOREIGN_FOUND=0
FOREIGN_DETAILS=""

for COMMIT in $COMMITS; do
  # このコミットを含むリモートブランチ（自ブランチと base を除外）
  OTHER_BRANCHES=$(git branch -r --contains "$COMMIT" 2>/dev/null \
    | grep -v "origin/$BRANCH" \
    | grep -v "origin/$BASE_BRANCH" \
    | grep -v "HEAD" \
    | sed 's/^[[:space:]]*//' \
    || true)

  if [ -n "$OTHER_BRANCHES" ]; then
    FOREIGN_FOUND=1
    SHORT=$(git log --oneline -1 "$COMMIT")
    FOREIGN_DETAILS="${FOREIGN_DETAILS}  ${SHORT}  ← ${OTHER_BRANCHES}\n"
  fi
done

if [ "$FOREIGN_FOUND" -eq 1 ]; then
  echo "BLOCKED: ブランチ '$BRANCH' に他ブランチ由来のコミットが含まれています。"
  echo ""
  echo "該当コミット:"
  echo -e "$FOREIGN_DETAILS"
  echo "PRに無関係な変更が混入する可能性があります。"
  echo "対処法: git rebase --onto '$BASE_BRANCH' <分岐元コミット> '$BRANCH'"
  exit 2
fi
