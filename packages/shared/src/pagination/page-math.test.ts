import { describe, expect, it } from "vitest";
import { clampPage, offsetFor, pageCount, parsePageParam } from "./page-math";

describe("parsePageParam", () => {
  it("数字を読む", () => {
    expect(parsePageParam("3")).toBe(3);
    expect(parsePageParam("1")).toBe(1);
  });

  it.each([undefined, "", "0", "-1", "1.5", "abc", "1e3日目"])(
    "不正な値 %o は1に倒す",
    (value) => {
      // 負の値をそのまま offset にすると DB がエラーを返す
      expect(parsePageParam(value)).toBe(1);
    }
  );
});

describe("pageCount", () => {
  it("割り切れないときは切り上げる", () => {
    expect(pageCount(31, 30)).toBe(2);
    expect(pageCount(60, 30)).toBe(2);
    expect(pageCount(61, 30)).toBe(3);
  });

  it("0件でも1ページある", () => {
    // 「見つかりませんでした」を出す先が要る
    expect(pageCount(0, 30)).toBe(1);
  });
});

describe("offsetFor", () => {
  it("1ページ目は0から始まる", () => {
    expect(offsetFor(1, 30)).toBe(0);
    expect(offsetFor(3, 50)).toBe(100);
  });
});

describe("clampPage", () => {
  it("範囲内はそのまま", () => {
    expect(clampPage(2, 4)).toBe(2);
  });

  it("範囲外は最終ページに丸める", () => {
    expect(clampPage(999, 4)).toBe(4);
  });

  it("1未満は1に倒す", () => {
    expect(clampPage(0, 4)).toBe(1);
  });
});
