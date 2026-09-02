import {
  clampPage,
  offsetFor,
  pageCount,
} from "@mirai-gikai/shared/pagination/page-math";
import type {
  BillSortConfig,
  BillWithCouncilSession,
} from "../../shared/types";
import { findBillsWithCouncilSessions } from "../repositories/bill-repository";

/** 管理画面の1ページに出す議案の数。 */
export const ADMIN_BILLS_PER_PAGE = 50;

export type BillsPage = {
  bills: BillWithCouncilSession[];
  total: number;
  /** 実際に表示しているページ。範囲外を指定されたら最終ページに丸める。 */
  page: number;
  totalPages: number;
};

/**
 * 議案の全件。コピー元の選択肢など、一覧に出さない用途で使う。
 *
 * Supabase の返却上限（既定1000行）に当たると古い議案が黙って落ちる。
 * 一覧の表示には使わないこと。
 */
export async function getBills(
  sortConfig?: BillSortConfig
): Promise<BillWithCouncilSession[]> {
  const { rows } = await findBillsWithCouncilSessions(sortConfig);
  return rows;
}

/**
 * 議案一覧の1ページ分を取得する。
 *
 * 範囲外のページを指定されたら最終ページに丸める。丸めずに問い合わせると
 * 表が空になり、ページ送りごと消えて戻る手段がなくなる。
 */
export async function getBillsPage(
  sortConfig: BillSortConfig | undefined,
  page: number
): Promise<BillsPage> {
  // 総件数は行と一緒に返ってくる。指定ページを引いて件数を確かめ、
  // 範囲外だったときだけ最終ページで引き直す。
  const first = await findBillsWithCouncilSessions(sortConfig, {
    limit: ADMIN_BILLS_PER_PAGE,
    offset: offsetFor(page, ADMIN_BILLS_PER_PAGE),
  });

  const total = first.total;
  const totalPages = pageCount(total, ADMIN_BILLS_PER_PAGE);
  const clamped = clampPage(page, totalPages);
  if (clamped === page) {
    return { bills: first.rows, total, page, totalPages };
  }

  const last = await findBillsWithCouncilSessions(sortConfig, {
    limit: ADMIN_BILLS_PER_PAGE,
    offset: offsetFor(clamped, ADMIN_BILLS_PER_PAGE),
  });
  return { bills: last.rows, total, page: clamped, totalPages };
}
