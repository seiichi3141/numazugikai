import { describe, expect, it } from "vitest";
import {
  BILL_PROGRESS_STEPS,
  calculateProgressWidth,
  getCurrentStep,
  getStatusMessage,
  getStepState,
} from "./bill-progress";

describe("BILL_PROGRESS_STEPS", () => {
  it("市議会の審議は提出から本会議議決までの4段階", () => {
    expect(BILL_PROGRESS_STEPS.map((step) => step.label)).toEqual([
      "提出",
      "委員会付託",
      "委員会審査",
      "本会議議決",
    ]);
  });
});

describe("getCurrentStep", () => {
  it("準備中はまだ始まっていない", () => {
    expect(getCurrentStep("preparing")).toBe(0);
  });

  it("提出・委員会審査で段階が進む", () => {
    expect(getCurrentStep("submitted")).toBe(1);
    expect(getCurrentStep("in_committee")).toBe(2);
  });

  it("継続審査は委員会審査の先で止まる", () => {
    expect(getCurrentStep("continued")).toBe(3);
  });

  it("議決が出たものはすべて最終段階", () => {
    for (const status of [
      "passed",
      "rejected",
      "consented",
      "approved",
      "certified",
      "adopted",
      "not_adopted",
      "withdrawn",
      "reported",
    ] as const) {
      expect(getCurrentStep(status)).toBe(4);
    }
  });
});

describe("getStatusMessage", () => {
  it("準備中は固定の文言を出す", () => {
    expect(getStatusMessage("preparing", "無視される")).toBe("議案提出前");
  });

  it("それ以外はステータス備考をそのまま出す", () => {
    expect(getStatusMessage("in_committee", "総務経済委員会で審査中")).toBe(
      "総務経済委員会で審査中"
    );
  });

  it("備考がなければ空文字", () => {
    expect(getStatusMessage("passed", null)).toBe("");
    expect(getStatusMessage("passed", undefined)).toBe("");
  });
});

describe("getStepState", () => {
  it("現在のステップ以前を active にする", () => {
    expect(getStepState(1, 2, false)).toBe("active");
    expect(getStepState(2, 2, false)).toBe("active");
    expect(getStepState(3, 2, false)).toBe("inactive");
  });

  it("準備中はどのステップも inactive", () => {
    expect(getStepState(1, 4, true)).toBe("inactive");
  });
});

describe("calculateProgressWidth", () => {
  it("段階に応じて0%から100%まで進む", () => {
    expect(calculateProgressWidth(0)).toBe(0);
    expect(calculateProgressWidth(4)).toBe(100);
  });

  it("進むほど幅が広がる", () => {
    const widths = [0, 1, 2, 3, 4].map(calculateProgressWidth);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1]);
    }
  });

  it("範囲外のステップは0%にする", () => {
    expect(calculateProgressWidth(99)).toBe(0);
    expect(calculateProgressWidth(-1)).toBe(0);
  });
});
