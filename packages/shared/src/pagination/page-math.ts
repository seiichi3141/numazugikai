/**
 * ページ番号まわりの算術。
 *
 * web と admin の両方の一覧が使う。1ページの件数（30件／50件）は一覧ごとの
 * 仕様なので各一覧が持つが、そこから出る計算まで各所で書き直すと
 * 「0件のときページ送りを出すか」のような規約が実装ごとにずれる。
 */

/**
 * URL のページ番号を 1 以上の整数に正規化する。
 *
 * 0 や負数、小数、文字列を渡されても 1 に倒す。そのまま offset の計算に
 * 使うと、負の offset で DB がエラーを返す。
 */
export function parsePageParam(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

/**
 * 総件数と1ページの件数からページ数を出す。
 *
 * 0件でも1ページある（「見つかりませんでした」を出す先が要る）。
 */
export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/** 1始まりのページ番号を offset に直す。 */
export function offsetFor(page: number, perPage: number): number {
  return (page - 1) * perPage;
}

/**
 * 要求されたページを実在する範囲に丸める。
 *
 * `?page=999` や、議案が減ったあとの古いリンクで一覧が空になると、
 * ページ送りごと消えて戻る手段がなくなる。
 */
export function clampPage(requested: number, totalPages: number): number {
  return Math.min(Math.max(requested, 1), totalPages);
}
