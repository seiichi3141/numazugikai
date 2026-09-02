import { describe, expect, it, vi } from "vitest";
import type { BillExplanationInput } from "../utils/build-explanation-prompt";
import { generateBillExplanation } from "./generate-bill-explanation";

const BILL: BillExplanationInput = {
  billNumber: "議第58号",
  name: "沼津市印鑑条例の一部改正",
  categoryLabel: "条例",
  submitterLabel: "市長",
  committee: "民生病院教育",
  decisionLabel: "可決",
  sessionName: "令和8年第13回（6月）定例会",
  explanationSource:
    "コンビニのマルチコピー機で印鑑登録証明書を取れるカードに、" +
    "特定在留カードと特定特別永住者証明書を追加します。",
};

const EXPLANATION = {
  title: "コンビニで印鑑証明を取れるカードが増えます",
  summary:
    "コンビニのマルチコピー機で印鑑登録証明書を受け取れる本人確認書類に、外国人住民向けのカードが加わります。",
  content: "## どんな議案か\n\n" + "本文".repeat(60),
};

describe("generateBillExplanation", () => {
  it("組み立てたプロンプトを生成関数に渡す", async () => {
    const generate = vi.fn().mockResolvedValue(EXPLANATION);
    const result = await generateBillExplanation({
      bill: BILL,
      difficulty: "normal",
      generate,
    });

    expect(result).toEqual(EXPLANATION);
    expect(generate).toHaveBeenCalledTimes(1);
    const prompt = generate.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("議第58号");
    expect(prompt).toContain("特定在留カード");
  });

  it("難易度によって渡すプロンプトが変わる", async () => {
    const generate = vi.fn().mockResolvedValue(EXPLANATION);
    await generateBillExplanation({ bill: BILL, difficulty: "hard", generate });
    expect(generate.mock.calls[0][0].prompt).toContain("改正の経緯");
  });

  it("議案説明が無ければ生成を呼ばずに落とす", async () => {
    // 材料なしで書かせるとモデルが一般知識で埋め、市政への誤解を招く
    const generate = vi.fn();
    await expect(
      generateBillExplanation({
        bill: { ...BILL, explanationSource: "" },
        difficulty: "normal",
        generate,
      })
    ).rejects.toThrow("議案説明が無いため解説を生成できない");
    expect(generate).not.toHaveBeenCalled();
  });

  it("空白だけの議案説明も材料なしとして扱う", async () => {
    const generate = vi.fn();
    await expect(
      generateBillExplanation({
        bill: { ...BILL, explanationSource: "   \n  " },
        difficulty: "normal",
        generate,
      })
    ).rejects.toThrow("議案説明が無いため");
    expect(generate).not.toHaveBeenCalled();
  });

  it("生成関数の失敗はそのまま伝える", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(
      generateBillExplanation({ bill: BILL, difficulty: "normal", generate })
    ).rejects.toThrow("timeout");
  });
});
