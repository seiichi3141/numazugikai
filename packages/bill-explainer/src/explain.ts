import {
  findBillsToExplain,
  upsertBillContent,
} from "./repositories/bill-explainer-repository";
import {
  createOpenAiGenerator,
  type GenerateExplanationFn,
  generateBillExplanation,
} from "./services/generate-bill-explanation";
import { DIFFICULTY_LEVELS, type DifficultyLevel } from "./shared/constants";
import { requireOpenAiApiKey } from "./shared/openai-api-key";
import {
  toCategoryLabel,
  toDecisionLabel,
  toSubmitterLabel,
} from "./utils/to-japanese-labels";

export {
  createOpenAiGenerator,
  generateBillExplanation,
} from "./services/generate-bill-explanation";
export type { BillExplanation } from "./shared/schemas";
export { billExplanationSchema } from "./shared/schemas";
export { buildExplanationPrompt } from "./utils/build-explanation-prompt";

export type ExplainResult = {
  billId: string;
  billNumber: string | null;
  name: string;
  /** 生成できた難易度 */
  generated: DifficultyLevel[];
  /** 生成に失敗した難易度とその理由 */
  failures: { difficulty: DifficultyLevel; reason: string }[];
};

export type ExplainOptions = {
  /** 会期の slug（例: 2026-13）で対象を絞る */
  sessionSlug?: string;
  /** 既に解説がある議案も作り直す */
  force?: boolean;
  /** 生成する議案の上限 */
  limit?: number;
  /** 生成する難易度。省略時は normal と hard の両方 */
  difficulties?: readonly DifficultyLevel[];
  /** テストで差し替える用。省略時は OPENAI_API_KEY で OpenAI を呼ぶ */
  generate?: GenerateExplanationFn;
};

/**
 * 議案の解説をまとめて生成する。
 *
 * 1件でも失敗したら全体を止める、ということはしない。議案ごとに独立して
 * 生成できるため、失敗は記録して次に進み、最後に結果を返す。
 */
export async function runExplain(
  options: ExplainOptions = {}
): Promise<ExplainResult[]> {
  const generate = options.generate ?? createDefaultGenerator();
  const difficulties = options.difficulties ?? DIFFICULTY_LEVELS;

  const bills = await findBillsToExplain({
    sessionSlug: options.sessionSlug,
    force: options.force,
    limit: options.limit,
  });

  const results: ExplainResult[] = [];

  for (const bill of bills) {
    const result: ExplainResult = {
      billId: bill.id,
      billNumber: bill.billNumber,
      name: bill.name,
      generated: [],
      failures: [],
    };

    for (const difficulty of difficulties) {
      try {
        const explanation = await generateBillExplanation({
          bill: {
            billNumber: bill.billNumber,
            name: bill.name,
            categoryLabel: toCategoryLabel(bill.category),
            submitterLabel: toSubmitterLabel(bill.submitter),
            committee: bill.committee,
            decisionLabel: toDecisionLabel(bill.status),
            explanationSource: bill.explanationSource,
            sessionName: bill.sessionName,
          },
          difficulty,
          generate,
        });

        await upsertBillContent({
          billId: bill.id,
          difficulty,
          title: explanation.title,
          summary: explanation.summary,
          content: explanation.content,
        });
        result.generated.push(difficulty);
      } catch (error) {
        result.failures.push({
          difficulty,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(
      `${bill.billNumber ?? bill.name}: 生成 ${result.generated.join(",") || "なし"}` +
        (result.failures.length > 0
          ? ` / 失敗 ${result.failures.map((f) => f.difficulty).join(",")}`
          : "")
    );
    results.push(result);
  }

  return results;
}

function createDefaultGenerator(): GenerateExplanationFn {
  return createOpenAiGenerator({
    apiKey: requireOpenAiApiKey("議案解説の生成"),
  });
}
