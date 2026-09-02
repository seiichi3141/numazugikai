import { parsePageParam } from "@mirai-gikai/shared/pagination/page-math";
import type { Route } from "next";
import { isUuid } from "@/features/open-data/shared/utils/uuid";
import { routes } from "@/lib/routes";
import { type BillStatusGroup, isBillStatusGroup } from "./bill-status-group";
import {
  type BillSortKey,
  DEFAULT_BILL_SORT,
  isBillSortKey,
} from "./sort-bills";

/** 一覧の絞り込み状態。すべて URL に載せる。 */
export type BillsListParams = {
  query: string;
  status: BillStatusGroup;
  /** タグ id。null は「すべて」。 */
  tagId: string | null;
  /** 会期の slug（例: 2026-13）。null は「すべて」。 */
  session: string | null;
  sort: BillSortKey;
  /** AIインタビュー受付中のみに絞るか。 */
  interviewOnly: boolean;
  /** 1始まりのページ番号。 */
  page: number;
};

/** 1ページに出す議案の数。 */
export const BILLS_PER_PAGE = 30;

/** ページ・コンポーネント間で共有する searchParams の形。 */
export type BillsListSearchParams = {
  q?: string | string[];
  status?: string | string[];
  tag?: string | string[];
  session?: string | string[];
  sort?: string | string[];
  interview?: string | string[];
  page?: string | string[];
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** 会期の slug の形（`2026-13` など）。 */
function isSessionSlug(value: string): boolean {
  return /^[0-9a-z]+(-[0-9a-z]+)*$/.test(value);
}

/** 絞り込みなしの一覧。ここから1つだけ差し替えてリンクを作る。 */
export const DEFAULT_BILLS_LIST_PARAMS: Readonly<BillsListParams> = {
  query: "",
  status: "all",
  tagId: null,
  session: null,
  sort: DEFAULT_BILL_SORT,
  interviewOnly: false,
  page: 1,
};

/**
 * URL パラメータを一覧の状態に正規化する純粋関数。
 * 不正値は既定に倒す。URL 直打ちでページを壊せないようにする。
 */
export function parseBillsListParams(
  searchParams: BillsListSearchParams
): BillsListParams {
  const status = firstValue(searchParams.status);
  const sort = firstValue(searchParams.sort);
  const tag = firstValue(searchParams.tag)?.trim();
  const session = firstValue(searchParams.session)?.trim();

  return {
    query: firstValue(searchParams.q)?.trim() ?? "",
    status: isBillStatusGroup(status) ? status : "all",
    // uuid でない値は DB 側の絞り込みで型変換に失敗し一覧が 500 になる。
    // 「該当なし」ではなく「絞り込みなし」に倒す。
    tagId: tag && isUuid(tag) ? tag : null,
    // slug は英数字とハイフンだけ。それ以外は絞り込みなしに倒す。
    session: session && isSessionSlug(session) ? session : null,
    sort: isBillSortKey(sort) ? sort : DEFAULT_BILL_SORT,
    interviewOnly: firstValue(searchParams.interview) === "1",
    page: parsePageParam(firstValue(searchParams.page)),
  };
}

/**
 * 現在の状態から1つだけ差し替えたクエリ文字列を作る純粋関数。
 * 既定値はURLに出さない。共有されたURLが読みやすくなる。
 */
export function buildBillsListQuery(
  current: BillsListParams,
  patch: Partial<BillsListParams> = {}
): string {
  // 絞り込みを変えたら1ページ目に戻す。3ページ目でタグを切り替えたときに、
  // 該当が3ページ分ないと空のページに飛んでしまう。
  // ページ送り自身（page だけを渡す呼び出し）は現在地を動かす側なので除く。
  const changesFilter = Object.keys(patch).some((key) => key !== "page");
  const next = {
    ...current,
    ...(changesFilter ? { page: 1 } : {}),
    ...patch,
  };
  const params = new URLSearchParams();

  if (next.query) params.set("q", next.query);
  if (next.status !== "all") params.set("status", next.status);
  if (next.tagId) params.set("tag", next.tagId);
  if (next.session) params.set("session", next.session);
  if (next.sort !== DEFAULT_BILL_SORT) params.set("sort", next.sort);
  if (next.interviewOnly) params.set("interview", "1");
  if (next.page > 1) params.set("page", String(next.page));

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * 一覧ページへのリンク。typedRoutes はクエリ付きのテンプレート文字列を
 * 推論できないため、キャストをこの関数だけに閉じる。
 */
export function billsListHref(
  current: BillsListParams,
  patch: Partial<BillsListParams> = {}
): Route {
  return `${routes.billsList()}${buildBillsListQuery(current, patch)}` as Route;
}
