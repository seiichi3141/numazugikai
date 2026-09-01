import { describe, expect, it } from "vitest";
import {
  toCategoryLabel,
  toDecisionLabel,
  toSubmitterLabel,
} from "./to-japanese-labels";

describe("toCategoryLabel", () => {
  it("地方自治法の区分を日本語にする", () => {
    expect(toCategoryLabel("ordinance")).toBe("条例");
    expect(toCategoryLabel("budget")).toBe("予算");
    expect(toCategoryLabel("petition")).toBe("請願・陳情");
  });

  it("未設定・未知の値は null", () => {
    expect(toCategoryLabel(null)).toBeNull();
    expect(toCategoryLabel("unknown_category")).toBeNull();
  });
});

describe("toSubmitterLabel", () => {
  it("提出者を日本語にする", () => {
    expect(toSubmitterLabel("mayor")).toBe("市長");
    expect(toSubmitterLabel("member")).toBe("議員");
  });

  it("未設定は null", () => {
    expect(toSubmitterLabel(null)).toBeNull();
  });
});

describe("toDecisionLabel", () => {
  it("議決が出たものは結果を返す", () => {
    expect(toDecisionLabel("passed")).toBe("可決");
    expect(toDecisionLabel("consented")).toBe("同意");
    expect(toDecisionLabel("not_adopted")).toBe("不採択");
  });

  it("まだ議決されていない段階は null（議決の行をプロンプトに出さない）", () => {
    expect(toDecisionLabel("preparing")).toBeNull();
    expect(toDecisionLabel("submitted")).toBeNull();
    expect(toDecisionLabel("in_committee")).toBeNull();
  });

  it("未設定は null", () => {
    expect(toDecisionLabel(null)).toBeNull();
  });
});
