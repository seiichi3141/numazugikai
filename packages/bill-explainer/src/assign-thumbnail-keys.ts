import type { BillThumbnailSubjectKey } from "@mirai-gikai/shared/bill-thumbnail/subjects";
import { mapWithConcurrency } from "@mirai-gikai/shared/concurrency/map-with-concurrency";
import {
  findBillsWithoutThumbnailKey,
  type ThumbnailTargetBill,
  updateBillThumbnailKey,
} from "./repositories/thumbnail-key-repository";
import {
  chooseThumbnailKey,
  createOpenAiThumbnailKeyGenerator,
  type GenerateThumbnailKeyFn,
} from "./services/choose-thumbnail-key";
import { requireOpenAiApiKey } from "./shared/openai-api-key";
import { toCategoryLabel } from "./utils/to-japanese-labels";

export type AssignThumbnailKeyResult = {
  billId: string;
  billNumber: string | null;
  name: string;
  key: BillThumbnailSubjectKey | null;
  /** 決められなかった理由。成功時は null */
  failure: string | null;
};

export type AssignThumbnailKeysOptions = {
  /** 会期の slug（例: 2026-13）で対象を絞る */
  sessionSlug?: string;
  /** 議案 ID で対象を絞る（解説を作り直した議案だけ決め直す、など） */
  billIds?: string[];
  /** 既に題材がある議案も決め直す */
  force?: boolean;
  /** 処理する議案の上限 */
  limit?: number;
  /** 同時に問い合わせる件数。省略時は 4 */
  concurrency?: number;
  /** テストで差し替える用。省略時は OPENAI_API_KEY で OpenAI を呼ぶ */
  generate?: GenerateThumbnailKeyFn;
};

const DEFAULT_CONCURRENCY = 4;

/**
 * 議案のサムネイル題材をまとめて決める。
 *
 * 解説の生成と同じく、議案ごとに独立して決められるので失敗は記録して
 * 次に進む。
 */
export async function runAssignThumbnailKeys(
  options: AssignThumbnailKeysOptions = {}
): Promise<AssignThumbnailKeyResult[]> {
  const generate =
    options.generate ??
    createOpenAiThumbnailKeyGenerator({
      apiKey: requireOpenAiApiKey("サムネイル題材の割り当て"),
    });
  const bills = await findBillsWithoutThumbnailKey({
    sessionSlug: options.sessionSlug,
    billIds: options.billIds,
    force: options.force,
    limit: options.limit,
  });

  return mapWithConcurrency(
    bills,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    (bill) => assignOne(bill, generate)
  );
}

async function assignOne(
  bill: ThumbnailTargetBill,
  generate: GenerateThumbnailKeyFn
): Promise<AssignThumbnailKeyResult> {
  const base = {
    billId: bill.id,
    billNumber: bill.billNumber,
    name: bill.name,
  };
  try {
    const key = await chooseThumbnailKey({
      bill: {
        name: bill.name,
        categoryLabel: toCategoryLabel(bill.category),
        title: bill.title,
        summary: bill.summary,
      },
      generate,
    });
    await updateBillThumbnailKey({ billId: bill.id, key });
    console.log(`${bill.billNumber ?? bill.name}: ${key}`);
    return { ...base, key, failure: null };
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    console.log(`${bill.billNumber ?? bill.name}: 失敗（${failure}）`);
    return { ...base, key: null, failure };
  }
}
