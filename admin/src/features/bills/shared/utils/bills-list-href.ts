import type { Route } from "next";
import { routes } from "@/lib/routes";

/** 議案一覧のURLに載る状態。並び替えとページ番号だけ。 */
export type BillsListHrefParams = {
  sort?: string;
  order?: string;
  page?: number;
};

/**
 * 議案一覧へのリンク。
 *
 * typedRoutes はクエリ付きのテンプレート文字列を推論できないため、
 * キャストをこの関数だけに閉じる。page.tsx 側でクエリを組み立てると
 * テストが書けないうえ、`as Route` が呼び出し箇所ぶん散らばる。
 *
 * 1ページ目はURLに出さない。共有されたURLが読みやすくなる。
 */
export function billsListHref(params: BillsListHrefParams = {}): Route {
  const query = new URLSearchParams();
  if (params.sort) query.set("sort", params.sort);
  if (params.order) query.set("order", params.order);
  if (params.page && params.page > 1) query.set("page", String(params.page));

  const queryString = query.toString();
  return `${routes.bills()}${queryString ? `?${queryString}` : ""}` as Route;
}
