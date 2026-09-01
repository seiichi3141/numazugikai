import { describe, expect, it } from "vitest";
import { buildDiverseRolesPlanPrompt } from "./build-diverse-roles-plan-prompt";

const baseBill = {
  name: "沼津市自転車の安全利用促進条例の制定について",
  knowledge_source: "自転車利用者団体ヒアリング",
  bill_content: {
    title: "自転車の安全利用ルールの整備",
    summary: "ヘルメット着用と保険加入を促す",
    content: "詳細条文",
  },
};

const baseConfig = {
  themes: ["通学路の安全", "地域経済への影響"],
};

describe("buildDiverseRolesPlanPrompt", () => {
  it("議案情報・テーマ・スロット件数を含む", () => {
    const out = buildDiverseRolesPlanPrompt({
      bill: baseBill,
      interviewConfig: baseConfig,
      slotsToPlan: [{}, {}, {}],
    });
    expect(out).toContain("沼津市自転車の安全利用促進条例の制定について");
    expect(out).toContain("自転車の安全利用ルールの整備");
    expect(out).toContain("ヘルメット着用と保険加入を促す");
    expect(out).toContain("通学路の安全");
    expect(out).toContain("地域経済への影響");
    expect(out).toContain("自転車利用者団体ヒアリング");
    expect(out).toContain("3 人の当事者");
    expect(out).toContain("3 件");
  });

  it("スロット行が件数分・順序通り出る", () => {
    const out = buildDiverseRolesPlanPrompt({
      bill: baseBill,
      interviewConfig: baseConfig,
      slotsToPlan: [{}, {}],
    });
    expect(out).toContain("- スロット 1:");
    expect(out).toContain("- スロット 2:");
    expect(out).not.toContain("- スロット 3:");
  });

  it("stanceHint 指定スロットは日本語ラベル付きで明示される", () => {
    const out = buildDiverseRolesPlanPrompt({
      bill: baseBill,
      interviewConfig: baseConfig,
      slotsToPlan: [{ stanceHint: "for" }, {}, { stanceHint: "against" }],
    });
    expect(out).toContain("- スロット 1: スタンス指定=賛成");
    expect(out).toContain("- スロット 2: スタンス指定なし");
    expect(out).toContain("- スロット 3: スタンス指定=反対");
  });

  it("preassignedRoleHints があれば重複回避セクションが入る", () => {
    const out = buildDiverseRolesPlanPrompt({
      bill: baseBill,
      interviewConfig: baseConfig,
      slotsToPlan: [{}],
      preassignedRoleHints: ["自転車販売店の事業者", "通学路沿いの住民"],
    });
    expect(out).toContain("既にユーザーが手動指定した役割");
    expect(out).toContain("- 自転車販売店の事業者");
    expect(out).toContain("- 通学路沿いの住民");
  });

  it("preassignedRoleHints が無い場合は重複回避セクションを出さない", () => {
    const out = buildDiverseRolesPlanPrompt({
      bill: baseBill,
      interviewConfig: baseConfig,
      slotsToPlan: [{}, {}],
    });
    expect(out).not.toContain("既にユーザーが手動指定した役割");
  });

  it("テーマ未設定時は明示する", () => {
    const out = buildDiverseRolesPlanPrompt({
      bill: { ...baseBill, knowledge_source: null },
      interviewConfig: { themes: [] },
      slotsToPlan: [{}, {}],
    });
    expect(out).toContain("（テーマ未設定）");
    expect(out).toContain("（知識ソース未設定）");
  });

  it("出力フォーマットの順序保持指示が含まれる", () => {
    const out = buildDiverseRolesPlanPrompt({
      bill: baseBill,
      interviewConfig: baseConfig,
      slotsToPlan: [{}, {}, {}],
    });
    expect(out).toContain("同じ件数（3 件）");
    expect(out).toContain("同じ順序");
  });

  it("「一般市民」を避ける指示が含まれる", () => {
    const out = buildDiverseRolesPlanPrompt({
      bill: baseBill,
      interviewConfig: baseConfig,
      slotsToPlan: [{}, {}],
    });
    expect(out).toContain("一般市民");
    expect(out).toContain("禁止");
  });
});
