import { describe, expect, it } from "vitest";
import { highlightMatch } from "./highlight-match";

describe("highlightMatch", () => {
  it("一致箇所の前後で分ける", () => {
    expect(highlightMatch("国民健康保険税を引き下げる議案", "保険")).toEqual([
      { text: "国民健康", matched: false },
      { text: "保険", matched: true },
      { text: "税を引き下げる議案", matched: false },
    ]);
  });

  it("先頭が一致したら前の断片を作らない", () => {
    expect(highlightMatch("国民健康保険税の議案", "国民")).toEqual([
      { text: "国民", matched: true },
      { text: "健康保険税の議案", matched: false },
    ]);
  });

  it("末尾が一致したら後の断片を作らない", () => {
    expect(highlightMatch("国民健康保険税の議案", "議案")).toEqual([
      { text: "国民健康保険税の", matched: false },
      { text: "議案", matched: true },
    ]);
  });

  it("大小文字を無視する", () => {
    expect(highlightMatch("AIの活用を進める議案", "ai")).toEqual([
      { text: "AI", matched: true },
      { text: "の活用を進める議案", matched: false },
    ]);
  });

  // タグ名や要約で当たった候補は、タイトルに一致箇所が無い。
  it("見つからなければ分けない", () => {
    expect(highlightMatch("国民健康保険税の議案", "暮らし")).toEqual([
      { text: "国民健康保険税の議案", matched: false },
    ]);
  });

  it("空クエリなら分けない", () => {
    expect(highlightMatch("国民健康保険税の議案", "   ")).toEqual([
      { text: "国民健康保険税の議案", matched: false },
    ]);
  });

  it("全文が一致したら1つの断片にする", () => {
    expect(highlightMatch("議案", "議案")).toEqual([
      { text: "議案", matched: true },
    ]);
  });
});
