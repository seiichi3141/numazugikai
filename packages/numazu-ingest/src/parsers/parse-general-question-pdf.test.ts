import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGeneralQuestionPdf } from "./parse-general-question-pdf";

describe("parseGeneralQuestionPdf", () => {
  it("登壇枠、階層項目、質問方式、答弁者を抽出する", () => {
    const parsed = parseGeneralQuestionPdf(`
      令和8年第13回（6月）定例会 一般質問通告一覧
      6月16日
      質問者：5番 山田 太郎（個人質問・一問一答方式）
      1 地域防災について
      （1）避難所の整備状況
      （2）情報伝達の改善
      答弁者：市長、危機管理監
    `);
    expect(parsed.sessionNumber).toBe(13);
    expect(parsed.sourceDates).toContain("2026-06-16");
    expect(parsed.appearances).toEqual([
      expect.objectContaining({
        speakerName: "山田太郎",
        seatNumber: 5,
        questionKind: "personal",
        deliveryMethod: "one_by_one",
        heldOn: "2026-06-16",
        answerers: ["市長", "危機管理監"],
        items: [
          expect.objectContaining({
            label: "地域防災について",
            parentSourceKey: null,
          }),
          expect.objectContaining({
            label: "避難所の整備状況",
            parentSourceKey: "appearance-1-item-1",
          }),
          expect.objectContaining({
            label: "情報伝達の改善",
            parentSourceKey: "appearance-1-item-1",
          }),
        ],
      }),
    ]);
  });

  it("複数日を列挙する旧レイアウトの資料日付を保持する", () => {
    const parsed = parseGeneralQuestionPdf(`
      第1回沼津市議会定例会 一 般 質 問
      令和５年６月１９日、２０日、２１日
    `);
    expect(parsed.sourceDates).toEqual([
      "2023-06-19",
      "2023-06-20",
      "2023-06-21",
    ]);
  });

  it("回数・表のない旧発言順レイアウトを解析する", () => {
    const parsed = parseGeneralQuestionPdf(`
      平成16年6月定例会
      ② 一般質問（発言順）
      滝 口 文 昭
      Ⅰ 市長の政治姿勢について
       1．広域連携について
        ⑴今後の進め方について
         ①住民への説明について
      加 藤 元 章
      Ⅰ 市長の政治姿勢について
       1．環境政策について
    `);
    expect(parsed).toMatchObject({
      sessionNumber: null,
      sessionYear: 2004,
      appearances: [
        {
          speakerName: "滝口文昭",
          questionOrder: 1,
          heldOn: null,
          answerers: [],
          items: [
            expect.objectContaining({
              label: "広域連携について",
              parentSourceKey: null,
            }),
            expect.objectContaining({
              label: "今後の進め方について",
              parentSourceKey: "appearance-1-item-1",
            }),
            expect.objectContaining({
              label: "住民への説明について",
              parentSourceKey: "appearance-1-item-1-1",
            }),
          ],
        },
        expect.objectContaining({
          speakerName: "加藤元章",
          questionOrder: 2,
        }),
      ],
    });
  });

  it("旧表組みの順番・席番号・氏名・答弁者を解析する", () => {
    const parsed = parseGeneralQuestionPdf(`
                         第1回沼津市議会定例会
                           一 般 質 問
      平成19年6月18日、19日
      順番    氏    名                 要        旨          答 弁 者
      1    3番            Ⅰ    市長の政治姿勢について              市   長
           二 村   祥   一       1．教育環境の整備について
                              ⑴教育改革への対応について
      2    2番            Ⅰ    防災について                        関係部長
           渡 部 一 二 実       1．避難所について
    `);
    expect(parsed.sourceDates).toEqual(["2007-06-18", "2007-06-19"]);
    expect(parsed.appearances).toEqual([
      expect.objectContaining({
        speakerName: "二村祥一",
        seatNumber: 3,
        questionOrder: 1,
        answerers: ["市長"],
        items: [
          expect.objectContaining({ label: "教育環境の整備について" }),
          expect.objectContaining({
            label: "教育改革への対応について",
          }),
        ],
      }),
      expect.objectContaining({
        speakerName: "渡部一二実",
        seatNumber: 2,
        questionOrder: 2,
        answerers: ["関係部長"],
      }),
    ]);
  });

  it("答弁者欄のない旧表組みを解析する", () => {
    const parsed = parseGeneralQuestionPdf(`
                    第9回沼津市議会定例会
                         一 般 質 問
      平成17年6月14日、15日
      順番    氏    名                    要   旨
       1   34番           Ⅰ    市長の政治姿勢について
           宮 代   義   幸       1．広域連携について
                               2．都市整備について
    `);
    expect(parsed.appearances).toEqual([
      expect.objectContaining({
        speakerName: "宮代義幸",
        seatNumber: 34,
        questionOrder: 1,
        answerers: [],
        items: [
          expect.objectContaining({ label: "広域連携について" }),
          expect.objectContaining({ label: "都市整備について" }),
        ],
      }),
    ]);
  });

  it("現任期PDFの表組みレイアウトを解析する", () => {
    const text = readFileSync(
      new URL(
        "./__fixtures__/general-question-r08-06-layout.txt",
        import.meta.url
      ),
      "utf8"
    );
    const parsed = parseGeneralQuestionPdf(text);
    expect(parsed.sessionNumber).toBe(13);
    expect(parsed.appearances).toEqual([
      expect.objectContaining({
        speakerName: "尾藤正弘",
        seatNumber: 12,
        questionOrder: 1,
        questionKind: "personal",
        deliveryMethod: "all_at_once",
        heldOn: "2026-06-15",
        answerers: ["市長", "選挙管理委員会委員長", "関係部長"],
        items: [
          expect.objectContaining({
            label: "新中間処理施設の整備に係る住民訴訟について",
            parentSourceKey: null,
          }),
          expect.objectContaining({
            label: "住民訴訟の内容",
            parentSourceKey: "appearance-1-item-1",
          }),
          expect.objectContaining({
            label: "判決に対する認識",
            parentSourceKey: "appearance-1-item-1",
          }),
          expect.objectContaining({
            label: "市営住宅の適正管理について",
            parentSourceKey: null,
          }),
          expect.objectContaining({
            label: "既存民間賃貸住宅の活用",
            parentSourceKey: "appearance-1-item-2",
          }),
        ],
      }),
    ]);
  });

  it("代表質問の会派欄を氏名として扱わない", () => {
    const text = readFileSync(
      new URL(
        "./__fixtures__/general-question-r08-02-representative-layout.txt",
        import.meta.url
      ),
      "utf8"
    );
    const [appearance] = parseGeneralQuestionPdf(text).appearances;
    expect(appearance).toMatchObject({
      speakerName: "川口慶",
      seatNumber: 1,
      questionOrder: 1,
      questionKind: "representative",
    });
  });
});
