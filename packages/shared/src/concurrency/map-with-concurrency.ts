/**
 * 配列の要素を最大 `maxConcurrency` 件ずつ並列に処理し、入力順の結果配列を返す。
 *
 * LLM 呼び出しのように互いに独立した処理を、直列で件数ぶん待たずに済ませる。
 * maxConcurrency が 0 以下でも最低 1 並列は確保する（worker が 0 個だと永久に終わらない）。
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  maxConcurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.min(Math.max(1, maxConcurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
