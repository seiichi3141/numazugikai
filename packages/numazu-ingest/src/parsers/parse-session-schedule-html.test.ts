import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSessionScheduleHtml } from "./parse-session-schedule-html";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

describe("parseSessionScheduleHtml: 実際の会期予定ページ", () => {
  const schedules = parseSessionScheduleHtml(
    readFileSync(join(FIXTURES, "yotei.html"), "utf-8")
  );

  it("掲載されている定例会をすべて取る", () => {
    expect(schedules).toHaveLength(4);
  });

  it("定例会名から回次と西暦年を割り出す", () => {
    expect(schedules[0]).toEqual({
      label: "令和8年第13回（6月）定例会",
      sessionNumber: 13,
      startDate: "2026-06-05",
      endDate: "2026-06-29",
    });
  });

  it("会期が月をまたぐ場合も同じ年に収める", () => {
    // 9月4日開会・10月8日閉会
    expect(schedules[1].startDate).toBe("2026-09-04");
    expect(schedules[1].endDate).toBe("2026-10-08");
  });

  it("年度が変わる定例会は定例会名の年に従う", () => {
    // 令和9年第16回（2月）定例会 = 2027年
    expect(schedules[3]).toEqual({
      label: "令和9年第16回（2月）定例会",
      sessionNumber: 16,
      startDate: "2027-02-08",
      endDate: "2027-03-16",
    });
  });
});

describe("parseSessionScheduleHtml: 個別のケース", () => {
  function buildTable(rows: ReadonlyArray<readonly string[]>): string {
    const body = rows
      .map(
        (cells) =>
          `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
      )
      .join("");
    return `<table>${body}</table>`;
  }

  it("閉会月が開会月より小さければ翌年とみなす", () => {
    const result = parseSessionScheduleHtml(
      buildTable([
        [
          "令和8年第15回（12月）定例会",
          "12月1日（月曜日）",
          "1月20日（火曜日）",
        ],
      ])
    );
    expect(result[0].startDate).toBe("2026-12-01");
    expect(result[0].endDate).toBe("2027-01-20");
  });

  it("臨時会も対象にする", () => {
    const result = parseSessionScheduleHtml(
      buildTable([
        ["令和8年第1回臨時会", "5月7日（木曜日）", "5月8日（金曜日）"],
      ])
    );
    expect(result).toHaveLength(1);
    expect(result[0].sessionNumber).toBe(1);
  });

  it("元年を1年として扱う", () => {
    const result = parseSessionScheduleHtml(
      buildTable([["令和元年第3回（9月）定例会", "9月2日", "9月30日"]])
    );
    expect(result[0].startDate).toBe("2019-09-02");
  });

  it("全角数字でも読み取る", () => {
    const result = parseSessionScheduleHtml(
      buildTable([["令和８年第１３回（６月）定例会", "６月５日", "６月２９日"]])
    );
    expect(result[0]).toMatchObject({
      sessionNumber: 13,
      startDate: "2026-06-05",
      endDate: "2026-06-29",
    });
  });

  it("見出し行や列数の足りない行は無視する", () => {
    const result = parseSessionScheduleHtml(
      buildTable([
        ["定例会", "開会予定日", "閉会予定日"],
        ["令和8年第13回（6月）定例会", "6月5日"],
        ["令和8年第14回（9月）定例会", "9月4日", "10月8日"],
      ])
    );
    expect(result).toHaveLength(1);
    expect(result[0].sessionNumber).toBe(14);
  });

  it("日付が読めない行は捨てる", () => {
    const result = parseSessionScheduleHtml(
      buildTable([["令和8年第13回（6月）定例会", "未定", "未定"]])
    );
    expect(result).toEqual([]);
  });

  it("表がなければ空配列", () => {
    expect(parseSessionScheduleHtml("<p>準備中</p>")).toEqual([]);
    expect(parseSessionScheduleHtml("")).toEqual([]);
  });
});
