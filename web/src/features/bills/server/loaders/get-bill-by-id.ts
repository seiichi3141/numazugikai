import { unstable_cache } from "next/cache";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { BillWithContent } from "../../shared/types";
import {
  findMiraiStanceByBillId,
  findPublishedBillById,
  findTagsByBillId,
} from "../repositories/bill-repository";
import { getBillContentWithDifficulty } from "./helpers/get-bill-content";

export async function getBillById(id: string): Promise<BillWithContent | null> {
  // キャッシュ外でcookiesにアクセス
  const difficultyLevel = await getDifficultyLevel();
  return getBillByIdWithDifficulty(id, difficultyLevel);
}

/**
 * 難易度を指定して議案を取る。
 *
 * cookie を持たない呼び出し（SNS のクローラー向け OGP 画像など）は
 * 利用者の設定を読めないので、こちらを既定の難易度で呼ぶ。
 */
export const getBillByIdWithDifficulty = unstable_cache(
  async (
    id: string,
    difficultyLevel: DifficultyLevelEnum
  ): Promise<BillWithContent | null> => {
    // 基本的なbill情報、見解、コンテンツ、タグを並列取得
    // 公開ステータスの議案のみを取得
    const [bill, miraiStance, billContent, billTags] = await Promise.all([
      findPublishedBillById(id),
      findMiraiStanceByBillId(id),
      getBillContentWithDifficulty(id, difficultyLevel),
      findTagsByBillId(id),
    ]);

    if (!bill) {
      console.error("Failed to fetch bill");
      return null;
    }

    // タグデータを整形
    const tags =
      billTags
        ?.map((bt) => bt.tags)
        .filter((tag): tag is { id: string; label: string } => tag !== null) ||
      [];

    return {
      ...bill,
      mirai_stance: miraiStance || undefined,
      bill_content: billContent || undefined,
      tags,
    };
  },
  ["bill-by-id"],
  {
    revalidate: 600, // 10分（600秒）
    tags: [CACHE_TAGS.BILLS],
  }
);
