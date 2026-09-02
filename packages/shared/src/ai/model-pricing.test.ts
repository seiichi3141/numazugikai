import { describe, expect, it } from "vitest";
import { estimateCostUsd, findModelPricing } from "./model-pricing";

describe("findModelPricing", () => {
  it("登録済みモデルの単価を返す", () => {
    expect(findModelPricing("gpt-5.6-luna")).toEqual({
      inputPerMillion: 0.25,
      outputPerMillion: 2.0,
    });
  });

  it("Gateway形式の接頭辞が付いていても引ける", () => {
    expect(findModelPricing("openai/gpt-5.6-luna")).toEqual(
      findModelPricing("gpt-5.6-luna")
    );
  });

  it("未登録モデルは null（費用不明として扱う）", () => {
    expect(findModelPricing("unknown-model")).toBeNull();
  });
});

describe("estimateCostUsd", () => {
  it("入力と出力の単価を足して費用を出す", () => {
    // 入力100万トークン=0.25ドル、出力100万トークン=2.0ドル
    const cost = estimateCostUsd({
      modelName: "gpt-5.6-luna",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(2.25, 10);
  });

  it("少量のトークンでも比例して計算する", () => {
    const cost = estimateCostUsd({
      modelName: "gpt-5.6-luna",
      inputTokens: 10_000,
      outputTokens: 2_000,
    });
    expect(cost).toBeCloseTo(0.0025 + 0.004, 10);
  });

  it("単価が分からないモデルは undefined（0にしない）", () => {
    // 0を返すと「無料で使えた」と記録され、コスト上限が働かなくなる
    expect(
      estimateCostUsd({
        modelName: "unknown-model",
        inputTokens: 1000,
        outputTokens: 1000,
      })
    ).toBeUndefined();
  });

  it("トークン数が取れない場合も undefined", () => {
    expect(
      estimateCostUsd({
        modelName: "gpt-5.6-luna",
        inputTokens: undefined,
        outputTokens: 100,
      })
    ).toBeUndefined();
    expect(
      estimateCostUsd({
        modelName: "gpt-5.6-luna",
        inputTokens: 100,
        outputTokens: undefined,
      })
    ).toBeUndefined();
  });

  it("トークン0なら費用0", () => {
    expect(
      estimateCostUsd({
        modelName: "gpt-5.6-luna",
        inputTokens: 0,
        outputTokens: 0,
      })
    ).toBe(0);
  });
});

describe("estimateCostUsd: 推論モデル", () => {
  it("推論トークンを含む outputTokens で計算する", () => {
    // gpt-5.6-luna は推論モデル。実測では出力551のうち512が推論トークンで、
    // 推論分も課金対象。AI SDK の totalUsage.outputTokens は推論分を含むため、
    // そのまま使えばよい（別途足す必要はない）
    const cost = estimateCostUsd({
      modelName: "gpt-5.6-luna",
      inputTokens: 61,
      outputTokens: 551,
    });
    expect(cost).toBeCloseTo(61e-6 * 0.25 + 551e-6 * 2.0, 12);
  });

  it("推論が長引くと費用も比例して上がる", () => {
    const short = estimateCostUsd({
      modelName: "gpt-5.6-luna",
      inputTokens: 100,
      outputTokens: 100,
    });
    const long = estimateCostUsd({
      modelName: "gpt-5.6-luna",
      inputTokens: 100,
      outputTokens: 5000,
    });
    expect(long).toBeGreaterThan(short as number);
  });
});
