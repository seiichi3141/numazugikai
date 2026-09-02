import type { DifficultyLevel } from "../shared/constants";
import { type BillExplanation, billExplanationSchema } from "../shared/schemas";
import {
  type BillExplanationInput,
  buildExplanationPrompt,
} from "../utils/build-explanation-prompt";
import { createOpenAiObjectGenerator } from "./openai-object-generator";

/** 生成の実行部。テストで Fake に差し替えられるよう切り出す。 */
export type GenerateExplanationFn = (params: {
  prompt: string;
}) => Promise<BillExplanation>;

/**
 * OpenAI API を直接呼ぶ実装。
 *
 * Vercel AI Gateway は経由しない。モデル名に `openai/` の接頭辞を付けないこと。
 */
export function createOpenAiGenerator(options: {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}): GenerateExplanationFn {
  return createOpenAiObjectGenerator({
    ...options,
    schema: billExplanationSchema,
  });
}

/**
 * 議案1件・1難易度分の解説を生成する。
 *
 * 材料（会議録から取り込んだ当局説明）が無い議案は生成しない。
 * 材料なしで書かせるとモデルが一般知識で埋め、市政への誤解を招く。
 */
export async function generateBillExplanation(params: {
  bill: BillExplanationInput;
  difficulty: DifficultyLevel;
  generate: GenerateExplanationFn;
}): Promise<BillExplanation> {
  if (!params.bill.explanationSource.trim()) {
    throw new Error(
      `議案説明が無いため解説を生成できない: ${params.bill.name}`
    );
  }

  const prompt = buildExplanationPrompt({
    bill: params.bill,
    difficulty: params.difficulty,
  });
  return params.generate({ prompt });
}
