import { describe, expect, it } from "vitest";
import { getCardStatusLabel, getStatusVariant } from "./bill-status";

describe("getCardStatusLabel", () => {
  it("一覧では細かい議決の種類をまとめて「可決」にする", () => {
    for (const status of [
      "passed",
      "consented",
      "approved",
      "certified",
      "adopted",
    ] as const) {
      expect(getCardStatusLabel(status)).toBe("可決");
    }
  });

  it("否決系はまとめて「否決」にする", () => {
    expect(getCardStatusLabel("rejected")).toBe("否決");
    expect(getCardStatusLabel("not_adopted")).toBe("否決");
  });

  it("審議中はまとめて「審議中」にする", () => {
    expect(getCardStatusLabel("submitted")).toBe("審議中");
    expect(getCardStatusLabel("in_committee")).toBe("審議中");
    expect(getCardStatusLabel("continued")).toBe("審議中");
  });

  it("撤回・報告はそのまま出す", () => {
    expect(getCardStatusLabel("withdrawn")).toBe("撤回");
    expect(getCardStatusLabel("reported")).toBe("報告");
  });

  it("準備中は提出前とする", () => {
    expect(getCardStatusLabel("preparing")).toBe("提出前");
  });
});

describe("getStatusVariant", () => {
  it("可決系は default", () => {
    expect(getStatusVariant("passed")).toBe("default");
    expect(getStatusVariant("consented")).toBe("default");
  });

  it("否決系は dark", () => {
    expect(getStatusVariant("rejected")).toBe("dark");
    expect(getStatusVariant("not_adopted")).toBe("dark");
  });

  it("審議中は light", () => {
    expect(getStatusVariant("in_committee")).toBe("light");
  });

  it("準備中は muted", () => {
    expect(getStatusVariant("preparing")).toBe("muted");
  });
});
