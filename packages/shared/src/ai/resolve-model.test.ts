import { describe, expect, it } from "vitest";
import { splitModelName, toDisplayModelName } from "./resolve-model";

describe("splitModelName", () => {
  it("Gateway形式の接頭辞を分ける", () => {
    expect(splitModelName("openai/gpt-5.6-luna")).toEqual({
      provider: "openai",
      model: "gpt-5.6-luna",
    });
  });

  it("接頭辞が無ければ provider は null", () => {
    expect(splitModelName("gpt-5.6-luna")).toEqual({
      provider: null,
      model: "gpt-5.6-luna",
    });
  });

  it("OpenAI以外のプロバイダも判別できる", () => {
    expect(splitModelName("anthropic/claude-haiku-4.5").provider).toBe(
      "anthropic"
    );
  });

  it("モデル名にスラッシュが複数あっても最初で分ける", () => {
    expect(splitModelName("openai/ft/my-model")).toEqual({
      provider: "openai",
      model: "ft/my-model",
    });
  });
});

describe("toDisplayModelName", () => {
  it("接頭辞を落とす", () => {
    expect(toDisplayModelName("openai/gpt-5.6-luna")).toBe("gpt-5.6-luna");
    expect(toDisplayModelName("gpt-5.6-luna")).toBe("gpt-5.6-luna");
  });
});
