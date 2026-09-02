/**
 * ページネーションの offset/limit 計算。
 *
 * ページ番号の並び（省略記号の入れ方）は表示側の都合なので、
 * `@mirai-gikai/shared/pagination/items` が持つ。
 */

/**
 * ページ番号からoffset（from）とlimit（to）を計算する
 */
export function calculatePaginationRange(
  page: number,
  perPage: number
): { from: number; to: number } {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  return { from, to };
}
