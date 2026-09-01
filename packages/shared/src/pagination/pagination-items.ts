/**
 * ページ送りに並べる要素。`gap` は省略を表す「…」。
 *
 * 省略は先頭側と末尾側に高々1つずつなので、`side` がそのまま一意なキーに
 * なる。位置（配列の添字）をキーにせずに済む。
 */
export type PaginationItem =
  | { type: "page"; page: number }
  | { type: "gap"; side: "start" | "end" };

/**
 * ページ送りに出す番号を決める。
 *
 * 39ページ分の番号を全部並べると、狭い画面で行が折り返して一覧より高くなる。
 * 先頭・末尾・現在地の前後だけを出し、飛ぶところに「…」を挟む。
 *
 * 現在地が端に寄っても出る番号の数を変えない。ページを送るたびに
 * 部品の幅が変わると、次へのボタンが指の下で動く。
 */
export function paginationItems(
  current: number,
  total: number,
  /** 現在地の左右に出す番号の数。 */
  siblings = 1
): PaginationItem[] {
  // 先頭・末尾・現在地・その左右・省略2つぶんを並べても全部載るなら、
  // 省略せずに全ページを出す。「1 … 3 … 5」より「1 2 3 4 5」が読みやすい。
  const windowSize = siblings * 2 + 5;
  if (total <= windowSize) {
    return range(1, total).map((page) => ({ type: "page", page }));
  }

  // 先頭と末尾を除いた中ほどの枠数。省略もこの枠を1つ使う。
  const middleSlots = windowSize - 2;
  let start = current - siblings;
  let end = current + siblings;

  // 端に寄ると片側の省略が要らなくなる。空いた枠は番号に回す。
  if (start <= 2) {
    start = 2;
    end = start + middleSlots - 2;
  } else if (end >= total - 1) {
    end = total - 1;
    start = end - (middleSlots - 2);
  }

  // 省略が1ページしか隠さないなら、そのページを出す。枠は同じで情報が増える。
  if (start === 3) start = 2;
  if (end === total - 2) end = total - 1;

  return [
    { type: "page", page: 1 },
    ...(start > 2 ? [{ type: "gap", side: "start" } as const] : []),
    ...range(start, end).map((page) => ({ type: "page" as const, page })),
    ...(end < total - 1 ? [{ type: "gap", side: "end" } as const] : []),
    { type: "page", page: total },
  ];
}

function range(start: number, end: number): number[] {
  if (end < start) return [];
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
