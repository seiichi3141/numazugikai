import { describe, expect, it } from "vitest";
import { parseGeneralQuestionMinutes } from "./parse-general-question-minutes";

describe("parseGeneralQuestionMinutes", () => {
  it("一般質問区間だけから登壇枠と答弁者役職を抽出し本文を保持しない", () => {
    const appearances = parseGeneralQuestionMinutes({
      heldOn: "2026-06-15",
      sourceKeyPrefix: "v20260513_03",
      text: `○議長（議長名）
日程第1 一般質問を行います。順次発言を許します。

○１２番議員（尾藤 正弘）
通告に基づき一般質問させていただきます。長い質問本文です。

○市長（市長名）
お答えいたします。長い答弁本文です。

○生活環境部長（部長名）
残余についてお答えします。

○１２番議員（尾藤 正弘）
2回目の質問です。

○議長（議長名）
6番 大草満議員。

○6番議員（大草 満）
通告に基づき一般質問します。

○教育長（教育長名）
お答えします。

○議長（議長名）
以上で一般質問を終わります。

○3番議員（対象外議員）
議案について質問します。`,
    });

    expect(appearances).toEqual([
      {
        sourceKey: "v20260513_03:appearance-1",
        speakerName: "尾藤正弘",
        seatNumber: 12,
        questionOrder: 1,
        questionKind: "unknown",
        deliveryMethod: "unknown",
        heldOn: "2026-06-15",
        items: [],
        answerers: ["市長", "生活環境部長"],
      },
      expect.objectContaining({
        sourceKey: "v20260513_03:appearance-2",
        speakerName: "大草満",
        questionOrder: 2,
        answerers: ["教育長"],
      }),
    ]);
    expect(JSON.stringify(appearances)).not.toContain("長い質問本文");
    expect(JSON.stringify(appearances)).not.toContain("長い答弁本文");
  });
});
