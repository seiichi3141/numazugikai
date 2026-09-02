import { describe, expect, it } from "vitest";
import { billsListHref } from "./bills-list-href";

describe("billsListHref", () => {
  it("何も無ければクエリを付けない", () => {
    expect(billsListHref()).toBe("/bills");
  });

  it("1ページ目はURLに出さない", () => {
    expect(billsListHref({ page: 1 })).toBe("/bills");
  });

  it("2ページ目以降は page を出す", () => {
    expect(billsListHref({ page: 3 })).toBe("/bills?page=3");
  });

  it("ページを送っても並び替えを落とさない", () => {
    expect(
      billsListHref({ sort: "submitted_date", order: "asc", page: 2 })
    ).toBe("/bills?sort=submitted_date&order=asc&page=2");
  });

  it("並び替えだけでも組み立てる", () => {
    expect(billsListHref({ sort: "status_order", order: "desc" })).toBe(
      "/bills?sort=status_order&order=desc"
    );
  });
});
