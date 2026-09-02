/**
 * モデルの単価（USD / 100万トークン）。
 *
 * OpenAI API を直接呼ぶと、Vercel AI Gateway が返していた費用情報
 * （providerMetadata.gateway.cost）が得られない。チャットには日次・月次の
 * コスト上限があり、費用が記録されないと上限が機能しなくなるため、
 * トークン数から自前で算出する。
 *
 * 単価は変わりうるので、未知のモデルは null を返して「費用不明」として扱う。
 * 推測した単価で上限を判定すると、課金を過小評価して上限をすり抜ける。
 */
export type ModelPricing = {
  /** 入力 100万トークンあたりのUSD */
  inputPerMillion: number;
  /** 出力 100万トークンあたりのUSD */
  outputPerMillion: number;
};

const PRICING: Record<string, ModelPricing> = {
  "gpt-5.6-luna": { inputPerMillion: 0.25, outputPerMillion: 2.0 },
  "gpt-5.6-sol": { inputPerMillion: 1.25, outputPerMillion: 10.0 },
  "gpt-5.6-terra": { inputPerMillion: 0.05, outputPerMillion: 0.4 },
  "gpt-5.4-mini-fast": { inputPerMillion: 0.25, outputPerMillion: 2.0 },
  "gpt-5.2": { inputPerMillion: 1.25, outputPerMillion: 10.0 },
};

/** モデルの単価を返す。未登録なら null（費用不明）。 */
export function findModelPricing(modelName: string): ModelPricing | null {
  const model = modelName.includes("/")
    ? modelName.slice(modelName.indexOf("/") + 1)
    : modelName;
  return PRICING[model] ?? null;
}

/**
 * トークン数から費用（USD）を求める。
 *
 * 単価が分からないモデル、トークン数が取れない場合は undefined を返す。
 * 0 を返すと「無料で使えた」と記録されてしまい、コスト上限が働かなくなる。
 */
export function estimateCostUsd(params: {
  modelName: string;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}): number | undefined {
  const pricing = findModelPricing(params.modelName);
  if (!pricing) return undefined;
  if (params.inputTokens === undefined || params.outputTokens === undefined) {
    return undefined;
  }

  const input = (params.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const output = (params.outputTokens / 1_000_000) * pricing.outputPerMillion;
  return input + output;
}
