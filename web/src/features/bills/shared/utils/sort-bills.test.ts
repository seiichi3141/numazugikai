import { describe, expect, it } from "vitest";
import { isBillSortKey } from "./sort-bills";

describe("isBillSortKey", () => {
  it("既知のキーだけ通す", () => {
    expect(isBillSortKey("new")).toBe(true);
    expect(isBillSortKey("status")).toBe(true);
    expect(isBillSortKey("voices")).toBe(true);
  });

  it("未知の値は弾く", () => {
    expect(isBillSortKey("popular")).toBe(false);
    expect(isBillSortKey(undefined)).toBe(false);
  });
});
