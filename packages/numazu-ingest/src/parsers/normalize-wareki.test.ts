import { describe, expect, it } from "vitest";
import {
  looksLikeWarekiDate,
  normalizeWarekiDate,
  toHalfWidthDigits,
} from "./normalize-wareki";

describe("toHalfWidthDigits", () => {
  it("全角数字を半角に直す", () => {
    expect(toHalfWidthDigits("発議第１号")).toBe("発議第1号");
    expect(toHalfWidthDigits("０１２３４５６７８９")).toBe("0123456789");
  });

  it("数字以外はそのまま残す", () => {
    expect(toHalfWidthDigits("令和８年２月")).toBe("令和8年2月");
  });
});

describe("normalizeWarekiDate", () => {
  it("令和の日付を西暦に変換する", () => {
    // 令和8年6月29日 = 2026-06-29（実際の第13回定例会の議決日）
    expect(normalizeWarekiDate("8.6.29", "令和")).toBe("2026-06-29");
  });

  it("令和元年は2019年になる", () => {
    expect(normalizeWarekiDate("1.5.1", "令和")).toBe("2019-05-01");
  });

  it("平成の日付を西暦に変換する", () => {
    expect(normalizeWarekiDate("31.4.30", "平成")).toBe("2019-04-30");
    expect(normalizeWarekiDate("1.1.8", "平成")).toBe("1989-01-08");
  });

  it("月日を2桁にゼロ埋めする", () => {
    expect(normalizeWarekiDate("8.2.6", "令和")).toBe("2026-02-06");
  });

  it("全角数字でも変換できる", () => {
    expect(normalizeWarekiDate("８.６.２９", "令和")).toBe("2026-06-29");
  });

  it("前後の空白を無視する", () => {
    expect(normalizeWarekiDate("  8.6.29  ", "令和")).toBe("2026-06-29");
  });

  it("元号が不明なら null", () => {
    expect(normalizeWarekiDate("8.6.29", null)).toBeNull();
    expect(normalizeWarekiDate("8.6.29", "大正")).toBeNull();
  });

  it("日付として成立しない値は null", () => {
    expect(normalizeWarekiDate("8.13.1", "令和")).toBeNull();
    expect(normalizeWarekiDate("8.2.30", "令和")).toBeNull();
    expect(normalizeWarekiDate("0.6.29", "令和")).toBeNull();
    expect(normalizeWarekiDate("8.6", "令和")).toBeNull();
    expect(normalizeWarekiDate("市長", "令和")).toBeNull();
  });
});

describe("looksLikeWarekiDate", () => {
  it("日付らしき文字列を判定する", () => {
    expect(looksLikeWarekiDate("8.6.29")).toBe(true);
    expect(looksLikeWarekiDate(" 8.2.6 ")).toBe(true);
    expect(looksLikeWarekiDate("８.６.２９")).toBe(true);
  });

  it("日付でないものは false", () => {
    expect(looksLikeWarekiDate("市長")).toBe(false);
    expect(looksLikeWarekiDate("可決すべきもの")).toBe(false);
    expect(looksLikeWarekiDate("8.6")).toBe(false);
  });
});
