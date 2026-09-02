import { describe, expect, it } from "vitest";
import { getSessionTiming, groupSessionsByYear } from "./session-timeline";

const session = { start_date: "2026-06-05", end_date: "2026-06-29" };

describe("getSessionTiming", () => {
  it.each([
    ["開会日の前日", "2026-06-04", "upcoming"],
    ["開会日当日", "2026-06-05", "ongoing"],
    ["閉会日当日", "2026-06-29", "ongoing"],
    ["閉会日の翌日", "2026-06-30", "closed"],
  ])("%s は %s", (_, today, expected) => {
    expect(getSessionTiming(session, today)).toBe(expected);
  });
});

describe("groupSessionsByYear", () => {
  it("開始日の年でまとめ、新しい年を先にする", () => {
    const grouped = groupSessionsByYear([
      { start_date: "2025-11-20", name: "11月" },
      { start_date: "2026-06-05", name: "6月" },
      { start_date: "2026-02-06", name: "2月" },
    ]);
    expect(grouped.map((g) => g.year)).toEqual([2026, 2025]);
    expect(grouped[0].sessions.map((s) => s.name)).toEqual(["6月", "2月"]);
  });

  it("空なら空", () => {
    expect(groupSessionsByYear([])).toEqual([]);
  });
});
