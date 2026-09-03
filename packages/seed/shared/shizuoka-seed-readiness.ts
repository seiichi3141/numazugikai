export const SHIZUOKA_SEED_BLOCKED_MESSAGE =
  "静岡県用 seed は未実装です。沼津市由来のデータを投入しないため、pnpm db:reset / pnpm seed を停止しました。";

/**
 * Phase 0 の間、沼津市版 seed による削除・投入を fail closed で防ぐ。
 * 静岡県用 seed の実装時に、準備完了を判定するガードへ置き換える。
 */
export function assertShizuokaSeedReady(): void {
  throw new Error(SHIZUOKA_SEED_BLOCKED_MESSAGE);
}
