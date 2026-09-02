import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
  BILL_EXPLAINER_MODEL,
  BILL_EXPLAINER_TIMEOUT_MS,
  type DifficultyLevel,
} from "../shared/constants";
import { type BillExplanation, billExplanationSchema } from "../shared/schemas";
import {
  type BillExplanationInput,
  buildExplanationPrompt,
} from "../utils/build-explanation-prompt";

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
  const openai = createOpenAI({ apiKey: options.apiKey });
  const model = options.model ?? BILL_EXPLAINER_MODEL;
  const timeoutMs = options.timeoutMs ?? BILL_EXPLAINER_TIMEOUT_MS;

  return async ({ prompt }) => {
    const { object } = await generateObject({
      model: openai(model),
      schema: billExplanationSchema,
      prompt,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    return object;
  };
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
