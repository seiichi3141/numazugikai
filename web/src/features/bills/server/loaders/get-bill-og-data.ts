import "server-only";

import { DEFAULT_DIFFICULTY } from "@/features/bill-difficulty/shared/types";
import {
  type BillOgText,
  buildBillOgText,
} from "../../shared/utils/bill-og-text";
import { getBillByIdWithDifficulty } from "./get-bill-by-id";

/**
 * OGP 画像の生成に必要な議案データを取得する。
 *
 * 公開済みの議案だけが返る。下書きの内容が SNS のカードから漏れない。
 * 解説は既定の難易度で固定する。OGP は cookie を持たない SNS のクローラーが
 * 取りに来るので、利用者の設定は使えない。
 * 議案ページと同じキャッシュに乗るので、admin の更新で一緒に無効化される。
 */
export async function getBillOgData(
  billId: string
): Promise<BillOgText | null> {
  const bill = await getBillByIdWithDifficulty(billId, DEFAULT_DIFFICULTY);
  if (!bill) return null;

  return buildBillOgText({
    name: bill.name,
    contentTitle: bill.bill_content?.title ?? null,
    summary: bill.bill_content?.summary ?? null,
    billNumber: bill.bill_number,
    status: bill.status,
    submittedDate: bill.submitted_date,
    tags: bill.tags,
  });
}
