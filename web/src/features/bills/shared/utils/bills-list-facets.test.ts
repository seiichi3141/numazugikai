import { describe, expect, it } from "vitest";
import { TAG_ALL, toBillsListFacets } from "./bills-list-facets";

describe("toBillsListFacets", () => {
  it("ステータスの件数を読む", () => {
    const facets = toBillsListFacets([
      { kind: "status", key: "all", count: 108 },
      { kind: "status", key: "enacted", count: 78 },
    ]);
    expect(facets.status.all).toBe(108);
    expect(facets.status.enacted).toBe(78);
  });

  it("行が返らなかったグループは0にする", () => {
    // DB は0件のグループを返さない。空欄のチップを出さないため。
    const facets = toBillsListFacets([
      { kind: "status", key: "all", count: 3 },
    ]);
    expect(facets.status.rejected).toBe(0);
    expect(facets.status.deliberating).toBe(0);
    expect(facets.status.waiting).toBe(0);
  });

  it("何も返らなくてもすべてのグループが0で揃う", () => {
    const facets = toBillsListFacets([]);
    expect(facets.status).toEqual({
      all: 0,
      deliberating: 0,
      waiting: 0,
      enacted: 0,
      rejected: 0,
    });
    expect(facets.tag.size).toBe(0);
  });

  it("タグの件数を id ごとに読む", () => {
    const facets = toBillsListFacets([
      { kind: "tag", key: "tag-1", count: 5 },
      { kind: "tag", key: "tag-2", count: 2 },
      { kind: "tag", key: "all", count: 7 },
    ]);
    expect(facets.tag.get("tag-1")).toBe(5);
    expect(facets.tag.get("tag-2")).toBe(2);
    expect(facets.tag.get(TAG_ALL)).toBe(7);
  });

  it("知らない種別やキーは読み飛ばす", () => {
    const facets = toBillsListFacets([
      { kind: "status", key: "unknown_group", count: 9 },
      { kind: "unknown_kind", key: "all", count: 9 },
      { kind: "status", key: null, count: 9 },
    ]);
    expect(facets.status.all).toBe(0);
    expect(facets.tag.size).toBe(0);
  });
});
