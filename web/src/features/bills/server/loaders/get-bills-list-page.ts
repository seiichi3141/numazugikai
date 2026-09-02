import "server-only";

import {
  clampPage,
  offsetFor,
  pageCount,
} from "@mirai-gikai/shared/pagination/page-math";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import type { BillListItem } from "../../shared/types";
import {
  type BillsListFacets,
  toBillsListFacets,
} from "../../shared/utils/bills-list-facets";
import {
  BILLS_PER_PAGE,
  type BillsListParams,
} from "../../shared/utils/parse-bills-list-params";
import {
  type BillsListFilter,
  countBillsForListFacets,
  searchBillsForList,
} from "../repositories/bill-repository";

export type BillsListPageData = {
  bills: BillListItem[];
  /** 絞り込み後の総件数。ページ送りの表示に使う。 */
  total: number;
  /** 実際に表示しているページ。範囲外を指定されたら最終ページに丸める。 */
  page: number;
  totalPages: number;
  facets: BillsListFacets;
  /** 実際に効いている会期の slug。存在しない slug は null（絞り込みなし）。 */
  session: string | null;
};

/**
 * 一覧の1ページ分と、チップに出す件数をまとめて取る。
 *
 * 件数をアプリ側で数えるには結局全件が要るので、DBで数えて返してもらう。
 * 検索と件数は同じ絞り込みを見るため、条件を1つの filter にまとめて渡す。
 *
 * 検索と件数は並べて投げる。直列にすると往復が1回増え、クエリ自体より
 * 往復のほうが高くつく。総件数は検索結果にも載って返るので、範囲外の
 * ページ（?page=999、消えた議案への古いリンク）だと分かったときだけ
 * 最終ページで引き直す。丸めずに返すと一覧が空になり、ページ送りごと
 * 消えて戻る手段がなくなる。
 *
 * キャッシュは挟まない。絞り込みの組み合わせごとに別のキーになり当たらない
 * うえ、どちらのクエリも数msで返る。
 */
export async function getBillsListPage(
  params: BillsListParams,
  difficultyLevel: DifficultyLevelEnum,
  /** 絞り込みに使える会期。URL の slug をこの中から引き当てる。 */
  sessions: readonly { id: string; slug: string }[] = []
): Promise<BillsListPageData> {
  // URL には slug を載せる。RPC は id で絞るので、渡された選択肢から引き当てる。
  // DB に問い合わせないのは、URL 直打ちの存在しない slug ごとにキャッシュを
  // 作らせないため。無い slug は「絞り込みなし」に倒し、効いている slug を
  // 返して呼び出し側のリンクからも消してもらう。残すと画面から外せなくなる。
  const session =
    sessions.find((candidate) => candidate.slug === params.session) ?? null;
  const filter: BillsListFilter = {
    difficultyLevel,
    query: params.query,
    tagId: params.tagId,
    statusGroup: params.status,
    interviewOnly: params.interviewOnly,
    sessionId: session?.id ?? null,
  };

  const [firstRows, facetRows] = await Promise.all([
    searchBillsForList(filter, {
      sort: params.sort,
      limit: BILLS_PER_PAGE,
      offset: offsetFor(params.page, BILLS_PER_PAGE),
    }),
    countBillsForListFacets(filter),
  ]);

  const facets = toBillsListFacets(facetRows);
  // 検索結果が空だと総件数も載ってこないので、件数はファセットから読む。
  const total = facets.status[params.status];
  const totalPages = pageCount(total, BILLS_PER_PAGE);
  const page = clampPage(params.page, totalPages);

  const rows =
    page === params.page
      ? firstRows
      : await searchBillsForList(filter, {
          sort: params.sort,
          limit: BILLS_PER_PAGE,
          offset: offsetFor(page, BILLS_PER_PAGE),
        });

  return {
    bills: rows.map(toBillListItem),
    total,
    page,
    totalPages,
    facets,
    session: session?.slug ?? null,
  };
}

type SearchRow = Awaited<ReturnType<typeof searchBillsForList>>[number];

function toBillListItem(row: SearchRow): BillListItem {
  return {
    id: row.id,
    name: row.name,
    bill_number: row.bill_number,
    status: row.status,
    submitted_date: row.submitted_date,
    thumbnail_url: row.thumbnail_url,
    thumbnail_key: row.thumbnail_key,
    is_review_completed: row.is_review_completed,
    bill_content: { title: row.content_title, summary: row.content_summary },
    tags: (row.tags ?? []) as BillListItem["tags"],
    hasPublicInterview: row.has_public_interview,
    publicReportCount: row.public_report_count,
  };
}
