import { describe, expect, it } from "vitest";
import { calculatePaginationRange } from "./pagination-utils";

describe("calculatePaginationRange", () => {
  it("1ページ目のoffsetは0", () => {
    expect(calculatePaginationRange(1, 30)).toEqual({ from: 0, to: 29 });
  });

  it("2ページ目のoffsetはperPage", () => {
    expect(calculatePaginationRange(2, 30)).toEqual({ from: 30, to: 59 });
  });

  it("3ページ目（perPage=10）", () => {
    expect(calculatePaginationRange(3, 10)).toEqual({ from: 20, to: 29 });
  });
});
