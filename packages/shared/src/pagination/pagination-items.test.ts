import { describe, expect, it } from "vitest";
import { type PaginationItem, paginationItems } from "./pagination-items";

/** 「1 … 4 5 6 … 39」の形で読めるようにする */
function render(items: PaginationItem[]): string {
  return items
    .map((item) => (item.type === "gap" ? "…" : String(item.page)))
    .join(" ");
}

describe("paginationItems", () => {
  it("1ページしかなければ1だけ返す", () => {
    expect(render(paginationItems(1, 1))).toBe("1");
  });

  it("全部載るなら省略しない", () => {
    expect(render(paginationItems(3, 7))).toBe("1 2 3 4 5 6 7");
  });

  it("先頭では後ろだけ省略する", () => {
    expect(render(paginationItems(1, 39))).toBe("1 2 3 4 5 … 39");
  });

  it("末尾では前だけ省略する", () => {
    expect(render(paginationItems(39, 39))).toBe("1 … 35 36 37 38 39");
  });

  it("中ほどでは前後を省略する", () => {
    expect(render(paginationItems(20, 39))).toBe("1 … 19 20 21 … 39");
  });

  it("端に寄っても出る番号の数を変えない", () => {
    // ページを送るたびに幅が変わると、ボタンが指の下で動く
    const widths = [1, 2, 3, 20, 37, 38, 39].map(
      (page) => paginationItems(page, 39).length
    );
    expect(new Set(widths).size).toBe(1);
  });

  it("現在地は必ず含まれる", () => {
    for (const page of [1, 2, 5, 20, 38, 39]) {
      const pages = paginationItems(page, 39)
        .filter((item) => item.type === "page")
        .map((item) => (item.type === "page" ? item.page : 0));
      expect(pages).toContain(page);
    }
  });

  it("番号は昇順で重複しない", () => {
    for (const total of [1, 5, 8, 39]) {
      for (let page = 1; page <= total; page++) {
        const pages = paginationItems(page, total)
          .filter((item) => item.type === "page")
          .map((item) => (item.type === "page" ? item.page : 0));
        expect(pages).toEqual([...new Set(pages)].sort((a, b) => a - b));
      }
    }
  });

  it("省略が1ページ分しか飛ばさない位置には出さない", () => {
    // 「1 … 3 4 5」の「…」が2しか隠さないなら、2を出したほうが短い
    expect(render(paginationItems(4, 39))).toBe("1 2 3 4 5 … 39");
  });
});
