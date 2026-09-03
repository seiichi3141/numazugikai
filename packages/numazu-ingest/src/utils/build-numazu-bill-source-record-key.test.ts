import { describe, expect, it } from "vitest";
import { buildNumazuBillSourceRecordKey } from "./build-numazu-bill-source-record-key";

describe("buildNumazuBillSourceRecordKey", () => {
  it.each([
    ["gi", "mayor", 58, "executive_bill:mayor:numbered:gi-58"],
    ["nin", "mayor", 1, "executive_bill:mayor:numbered:nin-1"],
    ["hou", "mayor", 14, "report:mayor:numbered:hou-14"],
    ["hatsugi", "member", 4, "member_bill:member:numbered:hatsugi-4"],
    ["seigan", null, 2, "petition:citizen:numbered:seigan-2"],
    ["chinjo", null, 3, "petition:citizen:numbered:chinjo-3"],
    ["gi", "committee", 1, "committee_bill:committee:numbered:gi-1"],
    ["hatsugi", "committee", 1, "committee_bill:committee:numbered:hatsugi-1"],
  ] as const)("%sを安定した共通keyへ写像する", (numberKind, submitter, numberValue, suffix) => {
    expect(
      buildNumazuBillSourceRecordKey({
        sessionSlug: "2026-13",
        numberKind,
        numberValue,
        submitter,
      })
    ).toBe(`numazu-city:2026-13:${suffix}`);
  });

  it.each([
    "gi",
    "nin",
    "hou",
    "hatsugi",
  ] as const)("提出者を確定できない%sはkeyを割り当てない", (numberKind) => {
    expect(
      buildNumazuBillSourceRecordKey({
        sessionSlug: "2026-13",
        numberKind,
        numberValue: 1,
        submitter: null,
      })
    ).toBeNull();
  });

  it.each([
    "",
    " 2026-13 ",
    "2026:13",
    "令和8-13",
  ])("不安定な会期slug %jにはkeyを割り当てない", (sessionSlug) => {
    expect(
      buildNumazuBillSourceRecordKey({
        sessionSlug,
        numberKind: "gi",
        numberValue: 1,
        submitter: "mayor",
      })
    ).toBeNull();
  });

  it("同じ会期・数値でも番号種別が異なれば衝突しない", () => {
    const build = (numberKind: "gi" | "nin") =>
      buildNumazuBillSourceRecordKey({
        sessionSlug: "2026-12",
        numberKind,
        numberValue: 1,
        submitter: "mayor",
      });

    expect(build("gi")).not.toBe(build("nin"));
  });

  it.each([
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])("不正な番号値%sにはkeyを割り当てない", (numberValue) => {
    expect(
      buildNumazuBillSourceRecordKey({
        sessionSlug: "2026-12",
        numberKind: "gi",
        numberValue,
        submitter: "mayor",
      })
    ).toBeNull();
  });
});
