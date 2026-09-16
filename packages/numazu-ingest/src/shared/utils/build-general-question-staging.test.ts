import { describe, expect, it } from "vitest";
import type { ParsedGeneralQuestionAppearance } from "../../parsers/parse-general-question-pdf";
import {
  buildGeneralQuestionStagingRows,
  fingerprintGeneralQuestionAppearance,
} from "./build-general-question-staging";

function appearance(
  sourceKey: string,
  speakerName: string
): ParsedGeneralQuestionAppearance {
  return {
    sourceKey,
    speakerName,
    seatNumber: null,
    questionOrder: null,
    questionKind: "unknown",
    deliveryMethod: "unknown",
    heldOn: null,
    items: [],
    answerers: [],
  };
}

describe("buildGeneralQuestionStagingRows", () => {
  it("新規・変更なし・変更・消滅を区別する", () => {
    const unchanged = appearance("a", "議員A");
    const changedBefore = appearance("b", "旧氏名");
    const missing = appearance("c", "議員C");
    const rows = buildGeneralQuestionStagingRows(
      [unchanged, appearance("b", "新氏名"), appearance("d", "議員D")],
      [
        {
          appearanceId: "id-a",
          sourceKey: "a",
          contentFingerprint: fingerprintGeneralQuestionAppearance(unchanged),
          parsedPayload: unchanged,
        },
        {
          appearanceId: "id-b",
          sourceKey: "b",
          contentFingerprint:
            fingerprintGeneralQuestionAppearance(changedBefore),
          parsedPayload: changedBefore,
        },
        {
          appearanceId: "id-c",
          sourceKey: "c",
          contentFingerprint: fingerprintGeneralQuestionAppearance(missing),
          parsedPayload: missing,
        },
      ]
    );
    expect(
      rows.map(({ sourceKey, changeKind }) => ({ sourceKey, changeKind }))
    ).toEqual([
      { sourceKey: "a", changeKind: "unchanged" },
      { sourceKey: "b", changeKind: "changed" },
      { sourceKey: "d", changeKind: "new" },
      { sourceKey: "c", changeKind: "missing" },
    ]);
  });

  it("重複したソースキーをambiguousにする", () => {
    const rows = buildGeneralQuestionStagingRows(
      [appearance("duplicate", "A"), appearance("duplicate", "B")],
      []
    );
    expect(rows).toHaveLength(1);
    expect(rows.every((row) => row.changeKind === "ambiguous")).toBe(true);
  });
});
