import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * モデル名を LanguageModel に解決する。
 *
 * 本サービスは OpenAI API を直接呼ぶ（Vercel AI Gateway は経由しない）。
 * ただしモデル名は本家から引き継いだ `openai/gpt-5.6-luna` のような
 * Gateway 形式で保存されている箇所がある（admin の interview_configs.chat_model など）ので、
 * 接頭辞を落としてから OpenAI に渡す。
 *
 * OpenAI 以外のプロバイダ（anthropic/ google/）が指定された場合は、
 * 直接接続の手段が無いため呼び出し側で扱えるようエラーにする。黙って
 * 別のモデルに差し替えると、管理画面の表示と実際に使われるモデルが食い違う。
 */
export function resolveOpenAiModel(
  modelName: string,
  options: { apiKey: string }
): LanguageModel {
  const { provider, model } = splitModelName(modelName);

  if (provider && provider !== "openai") {
    throw new Error(
      `OpenAI 以外のモデルは直接呼び出せない: ${modelName}。` +
        `OpenAI のモデル名を指定すること`
    );
  }

  const openai = createOpenAI({ apiKey: options.apiKey });
  return openai(model);
}

/**
 * `openai/gpt-5.6-luna` を `{ provider: "openai", model: "gpt-5.6-luna" }` に分ける。
 * 接頭辞が無ければ provider は null。
 */
export function splitModelName(modelName: string): {
  provider: string | null;
  model: string;
} {
  const index = modelName.indexOf("/");
  if (index === -1) {
    return { provider: null, model: modelName };
  }
  return {
    provider: modelName.slice(0, index),
    model: modelName.slice(index + 1),
  };
}

/** 表示・記録用のモデル名（接頭辞を落とした形）。 */
export function toDisplayModelName(modelName: string): string {
  return splitModelName(modelName).model;
}
