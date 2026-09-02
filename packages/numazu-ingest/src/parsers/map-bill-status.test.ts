import { describe, expect, it } from "vitest";
import {
  buildSessionName,
  buildSessionSlug,
  toBillStatus,
  toStatusNote,
} from "./map-bill-status";

describe("toBillStatus", () => {
  it("議決結果があればそれをステータスにする", () => {
    expect(toBillStatus("passed", "総務経済")).toBe("passed");
    expect(toBillStatus("consented", "省略")).toBe("consented");
    expect(toBillStatus("reported", null)).toBe("reported");
  });

  it("議決前で委員会に付託済みなら審査中", () => {
    expect(toBillStatus(null, "民生病院教育")).toBe("in_committee");
  });

  it("付託省略は審査中にしない", () => {
    expect(toBillStatus(null, "省略")).toBe("submitted");
  });

  it("委員会が分からなければ提出済みとする", () => {
    expect(toBillStatus(null, null)).toBe("submitted");
  });
});

describe("toStatusNote", () => {
  it("委員会の審査結果と本会議の議決を1文にまとめる", () => {
    expect(toStatusNote("passed", "民生病院教育", "可決すべきもの")).toBe(
      "民生病院教育委員会が「可決すべきもの」と決定し、本会議で可決"
    );
  });

  it("付託省略の議案は本会議の結果だけを書く", () => {
    expect(toStatusNote("consented", "省略", null)).toBe("本会議で同意");
  });

  it("審査中は委員会名を出す", () => {
    expect(toStatusNote(null, "総務経済", null)).toBe("総務経済委員会で審査中");
  });

  it("情報がなければ null", () => {
    expect(toStatusNote(null, null, null)).toBeNull();
  });
});

describe("buildSessionSlug", () => {
  it("西暦年と回次から作る", () => {
    expect(buildSessionSlug(2026, 13)).toBe("2026-13");
  });

  it("年をまたいでも回次で区別できる", () => {
    expect(buildSessionSlug(2027, 16)).toBe("2027-16");
  });
});

describe("buildSessionName", () => {
  it("会期予定ページの表記にそろえる", () => {
    expect(
      buildSessionName({
        year: 2026,
        sessionNumber: 13,
        month: 6,
        kind: "regular",
      })
    ).toBe("令和8年第13回（6月）定例会");
  });

  it("議案審議結果PDF由来でも同じ表記になる", () => {
    // PDFの見出しは「第13回（令和８年６月）定例会」だが、同じ名前に正規化する
    expect(
      buildSessionName({
        year: 2026,
        sessionNumber: 13,
        month: 6,
        kind: "regular",
        era: "令和",
      })
    ).toBe("令和8年第13回（6月）定例会");
  });

  it("臨時会は臨時会と表記する", () => {
    expect(
      buildSessionName({
        year: 2026,
        sessionNumber: 1,
        month: 5,
        kind: "extraordinary",
      })
    ).toBe("令和8年第1回（5月）臨時会");
  });

  it("月が分からなければ月の表記を省く", () => {
    expect(
      buildSessionName({
        year: 2026,
        sessionNumber: 13,
        month: null,
        kind: "regular",
      })
    ).toBe("令和8年第13回定例会");
  });

  it("平成の会期も元号年に直す", () => {
    expect(
      buildSessionName({
        year: 2018,
        sessionNumber: 5,
        month: 9,
        kind: "regular",
        era: "平成",
      })
    ).toBe("平成30年第5回（9月）定例会");
  });
});
