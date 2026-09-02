import { resolveOpenAiModel } from "@mirai-gikai/shared/ai/resolve-model";
import { generateObject } from "ai";
import type { z } from "zod";
import {
  BILL_EXPLAINER_MODEL,
  BILL_EXPLAINER_TIMEOUT_MS,
} from "../shared/constants";

/**
 * OpenAI API を直接呼び、スキーマどおりの構造化出力を返す生成器を作る。
 *
 * 解説の生成もサムネイル題材の選択も「プロンプトを渡してオブジェクトを受け取る」
 * だけなので、スキーマとタイムアウト以外は共通にする。
 */
export function createOpenAiObjectGenerator<
  T extends z.ZodObject<z.ZodRawShape>,
>(options: {
  apiKey: string;
  schema: T;
  model?: string;
  timeoutMs?: number;
}): (params: { prompt: string }) => Promise<z.infer<T>> {
  const model = resolveOpenAiModel(options.model ?? BILL_EXPLAINER_MODEL, {
    apiKey: options.apiKey,
  });
  const timeoutMs = options.timeoutMs ?? BILL_EXPLAINER_TIMEOUT_MS;

  return async ({ prompt }) => {
    const { object } = await generateObject({
      model,
      schema: options.schema,
      prompt,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    // generateObject の戻り値の型は具体的なスキーマでしか決まらず、
    // 汎用の T では conditional type が解決されないため、ここで確定させる。
    return object as z.infer<T>;
  };
}
