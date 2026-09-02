import { describe, expect, it } from "vitest";
import { toSessionFilterOptions } from "./session-filter-options";

const sessions = [
  { id: "s-new", slug: "2026-13", name: "令和8年第13回（6月）定例会" },
  { id: "s-old", slug: "2026-12", name: "令和8年第12回（2月）定例会" },
  { id: "s-empty", slug: "2026-14", name: "令和8年第14回（9月）定例会" },
];

describe("toSessionFilterOptions", () => {
  it("先頭に「すべて」を置き、会期は渡した順のまま件数を付ける", () => {
    const counts = new Map([
      ["all", 95],
      ["s-new", 30],
      ["s-old", 65],
    ]);
    expect(toSessionFilterOptions(sessions, counts, null)).toEqual([
      { value: "", label: "すべての会期", count: 95 },
      { value: "2026-13", label: "令和8年第13回（6月）定例会", count: 30 },
      { value: "2026-12", label: "令和8年第12回（2月）定例会", count: 65 },
    ]);
  });

  it("0件の会期は落とすが、選択中なら残す", () => {
    const counts = new Map([
      ["all", 30],
      ["s-new", 30],
    ]);
    expect(
      toSessionFilterOptions(sessions, counts, "2026-14").map((o) => o.value)
    ).toEqual(["", "2026-13", "2026-14"]);
  });

  it("件数が無ければ「すべて」は0件", () => {
    expect(toSessionFilterOptions([], new Map(), null)).toEqual([
      { value: "", label: "すべての会期", count: 0 },
    ]);
  });
});
