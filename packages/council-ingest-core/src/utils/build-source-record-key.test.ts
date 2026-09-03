import { describe, expect, it } from "vitest";
import { buildSourceRecordKey } from "./build-source-record-key";

const base = {
  siteKey: "shizuoka-pref",
  sessionKey: "2026-02-regular",
  documentKind: "executive_bill" as const,
  submitterKind: "governor" as const,
};

describe("buildSourceRecordKey", () => {
  it("同じ会期と番号でも提出区分が異なれば別keyになる", () => {
    const governor = buildSourceRecordKey({
      ...base,
      identity: { kind: "numbered", normalizedNumber: "1" },
    });
    const member = buildSourceRecordKey({
      ...base,
      documentKind: "member_bill",
      submitterKind: "member",
      identity: { kind: "numbered", normalizedNumber: "1" },
    });

    expect(governor).not.toBe(member);
  });

  it.each([
    ["siteKey", { siteKey: "another-site" }],
    ["sessionKey", { sessionKey: "2026-06-regular" }],
    ["documentKind", { documentKind: "report" as const }],
    ["submitterKind", { submitterKind: "member" as const }],
  ] as const)("%sだけが異なる場合も別keyになる", (_name, override) => {
    const original = buildSourceRecordKey({
      ...base,
      identity: { kind: "numbered", normalizedNumber: "1" },
    });
    const changed = buildSourceRecordKey({
      ...base,
      ...override,
      identity: { kind: "numbered", normalizedNumber: "1" },
    });

    expect(changed).not.toBe(original);
  });

  it("番号とstable IDを別namespaceにする", () => {
    const numbered = buildSourceRecordKey({
      ...base,
      identity: { kind: "numbered", normalizedNumber: "1" },
    });
    const stable = buildSourceRecordKey({
      ...base,
      identity: { kind: "stable", stableId: "1" },
    });

    expect(numbered).not.toBe(stable);
  });

  it("区切り文字を含む値をsegment単位でescapeする", () => {
    const key = buildSourceRecordKey({
      ...base,
      sessionKey: "2026:02 regular",
      identity: { kind: "numbered", normalizedNumber: "第1号/議案" },
    });

    expect(key).toContain("2026%3A02%20regular");
    expect(key).toContain("%E7%AC%AC1%E5%8F%B7%2F%E8%AD%B0%E6%A1%88");
  });

  it("前後の空白をkeyへ含めない", () => {
    const key = buildSourceRecordKey({
      ...base,
      siteKey: " shizuoka-pref ",
      identity: { kind: "stable", stableId: " opinion-001 " },
    });

    expect(key).toBe(
      "shizuoka-pref:2026-02-regular:executive_bill:governor:stable:opinion-001"
    );
  });

  it("空segmentを拒否する", () => {
    expect(() =>
      buildSourceRecordKey({
        ...base,
        identity: { kind: "stable", stableId: " " },
      })
    ).toThrowError("identity must not be empty");
  });
});
