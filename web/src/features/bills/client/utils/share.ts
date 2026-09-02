import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { getBillOgVersion } from "@/features/bills/shared/utils/get-bill-og-version";
import { ogImageUrls } from "@/lib/og/og-image-urls";
import { getOrigin } from "@/lib/utils/url";
import type { BillWithContent } from "../../shared/types";

/**
 * シェアURLを生成
 */
export function createBillShareUrl(
  origin: string,
  billId: string,
  difficulty: DifficultyLevelEnum
): string {
  return `${origin}/bills/${billId}?difficulty=${difficulty}`;
}

/**
 * シェアメッセージを生成
 */
export function createShareMessage(bill: BillWithContent): string {
  const displayTitle = bill.bill_content?.title ?? bill.name;
  return `${displayTitle} #みらい議会沼津市`;
}

/**
 * シェアに必要なコンテキスト情報を取得
 */
export async function getShareContext(): Promise<{
  origin: string;
  difficulty: DifficultyLevelEnum;
}> {
  const [origin, difficulty] = await Promise.all([
    getOrigin(),
    getDifficultyLevel(),
  ]);

  return { origin, difficulty };
}

/**
 * 議案のシェアに必要なすべてのデータを取得
 */
export async function getBillShareData(bill: BillWithContent) {
  const { origin, difficulty } = await getShareContext();

  return {
    shareUrl: createBillShareUrl(origin, bill.id, difficulty),
    shareMessage: createShareMessage(bill),
    // プレビューは SNS に出るカードと同じ画像にする。相対パスなら next/image に
    // そのまま渡せる（同一オリジンでも絶対 URL だと remotePatterns が要る）
    thumbnailUrl: ogImageUrls.billPath(bill.id, getBillOgVersion(bill)),
  };
}
