import { mapWithConcurrency } from "@mirai-gikai/shared/concurrency/map-with-concurrency";
import {
  findAvailableBillTags,
  findBillsToAssignTags,
  replaceBillTags,
} from "./repositories/bill-tag-repository";
import {
  chooseBillTags,
  createOpenAiBillTagsGenerator,
  type GenerateBillTagsFn,
} from "./services/choose-bill-tags";
import { requireOpenAiApiKey } from "./shared/openai-api-key";
import { toCategoryLabel } from "./utils/to-japanese-labels";

export type AssignBillTagsResult = {
  billId: string;
  billNumber: string | null;
  name: string;
  labels: string[];
  failure: string | null;
};

export type AssignBillTagsOptions = {
  sessionSlug?: string;
  billIds?: string[];
  /** 既存のタグがある議案もAIで再分類する。既存分の一括移行に使用する。 */
  force?: boolean;
  limit?: number;
  concurrency?: number;
  generate?: GenerateBillTagsFn;
};

const DEFAULT_CONCURRENCY = 4;

/** DB上のテーマ定義を使い、既存・新規議案を同じAI基準で分類する。 */
export async function runAssignBillTags(
  options: AssignBillTagsOptions = {}
): Promise<AssignBillTagsResult[]> {
  if (options.billIds?.length === 0) return [];
  const generate =
    options.generate ??
    createOpenAiBillTagsGenerator({
      apiKey: requireOpenAiApiKey("議案のテーマタグ付け"),
    });
  const [tags, bills] = await Promise.all([
    findAvailableBillTags(),
    findBillsToAssignTags(options),
  ]);

  return mapWithConcurrency(
    bills,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    (bill) => assignOne(bill, tags, generate)
  );
}

async function assignOne(
  bill: Awaited<ReturnType<typeof findBillsToAssignTags>>[number],
  tags: Awaited<ReturnType<typeof findAvailableBillTags>>,
  generate: GenerateBillTagsFn
): Promise<AssignBillTagsResult> {
  const base = {
    billId: bill.id,
    billNumber: bill.billNumber,
    name: bill.name,
  };
  try {
    const selected = await chooseBillTags({
      bill: {
        name: bill.name,
        categoryLabel: toCategoryLabel(bill.category),
        title: bill.title,
        summary: bill.summary,
        explanationSource: bill.explanationSource,
      },
      tags,
      generate,
    });
    await replaceBillTags({
      billId: bill.id,
      managedTagIds: tags.map((tag) => tag.id),
      nextTagIds: selected.map((tag) => tag.id),
    });
    const labels = selected.map((tag) => tag.label);
    console.log(`${bill.billNumber ?? bill.name}: ${labels.join(", ")}`);
    return { ...base, labels, failure: null };
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    console.log(`${bill.billNumber ?? bill.name}: 失敗（${failure}）`);
    return { ...base, labels: [], failure };
  }
}
