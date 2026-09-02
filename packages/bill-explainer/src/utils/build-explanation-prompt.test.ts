import { describe, expect, it } from "vitest";
import { MAX_EXPLANATION_CHARS } from "../shared/constants";
import {
  type BillExplanationInput,
  buildExplanationPrompt,
} from "./build-explanation-prompt";

const BILL: BillExplanationInput = {
  billNumber: "議第58号",
  name: "沼津市印鑑条例の一部改正",
  categoryLabel: "条例",
  submitterLabel: "市長",
  committee: "民生病院教育",
  decisionLabel: "可決",
  sessionName: "令和8年第13回（6月）定例会",
  explanationSource:
    "本議案は、出入国管理及び難民認定法等の一部改正に伴い、多機能端末機等による" +
    "印鑑登録証明書の交付に関する規定を改めるものです。コンビニのマルチコピー機で" +
    "使えるカードに、特定在留カードと特定特別永住者証明書を追加します。",
};

describe("buildExplanationPrompt: 議案の情報", () => {
  const prompt = buildExplanationPrompt({ bill: BILL, difficulty: "normal" });

  it("公式資料と照合できるよう議案番号と正式名称を含める", () => {
    expect(prompt).toContain("議案番号: 議第58号");
    expect(prompt).toContain("正式名称: 沼津市印鑑条例の一部改正");
  });

  it("審議の経緯を材料として渡す", () => {
    expect(prompt).toContain("会期: 令和8年第13回（6月）定例会");
    expect(prompt).toContain("分類: 条例");
    expect(prompt).toContain("提出者: 市長");
    expect(prompt).toContain("付託委員会: 民生病院教育委員会");
    expect(prompt).toContain("本会議の議決: 可決");
  });

  it("議案説明をタグで囲んで渡す", () => {
    expect(prompt).toContain("<explanation>");
    expect(prompt).toContain("特定在留カード");
    expect(prompt).toContain("</explanation>");
  });

  it("情報が無い項目は行ごと省く", () => {
    const prompt = buildExplanationPrompt({
      bill: {
        ...BILL,
        billNumber: null,
        committee: null,
        decisionLabel: null,
        categoryLabel: null,
        submitterLabel: null,
        sessionName: null,
      },
      difficulty: "normal",
    });
    expect(prompt).not.toContain("議案番号:");
    expect(prompt).not.toContain("付託委員会:");
    expect(prompt).not.toContain("本会議の議決:");
    // 正式名称は常に必要
    expect(prompt).toContain("正式名称: 沼津市印鑑条例の一部改正");
  });
});

describe("buildExplanationPrompt: 誤情報を防ぐ制約", () => {
  const prompt = buildExplanationPrompt({ bill: BILL, difficulty: "normal" });

  it("材料にないことを書かせない", () => {
    expect(prompt).toContain("材料に書かれていないことは書かないでください");
    expect(prompt).toContain("推測");
  });

  it("賛否や評価を書かせない", () => {
    expect(prompt).toContain("賛否や評価を書かないでください");
  });

  it("分量のために内容を膨らませない", () => {
    expect(prompt).toContain("分量を満たすために内容を膨らませてはいけません");
  });

  it("議員個人や会派の名前を出させない", () => {
    expect(prompt).toContain("議員個人や会派の名前を出さないでください");
  });
});

describe("buildExplanationPrompt: 難易度", () => {
  it("やさしい版は中学生でも読める言葉を求める", () => {
    const prompt = buildExplanationPrompt({ bill: BILL, difficulty: "normal" });
    expect(prompt).toContain("中学生が読んでも分かる言葉");
    expect(prompt).toContain("600〜900文字");
  });

  it("くわしい版は背景まで書かせる", () => {
    const prompt = buildExplanationPrompt({ bill: BILL, difficulty: "hard" });
    expect(prompt).toContain("改正の経緯");
    expect(prompt).toContain("1000〜1600文字");
  });

  it("難易度によって指示が入れ替わる", () => {
    const normal = buildExplanationPrompt({ bill: BILL, difficulty: "normal" });
    const hard = buildExplanationPrompt({ bill: BILL, difficulty: "hard" });
    expect(normal).not.toContain("1000〜1600文字");
    expect(hard).not.toContain("中学生が読んでも分かる言葉");
  });
});

describe("buildExplanationPrompt: 長い議案説明", () => {
  it("上限を超える説明は切り詰める", () => {
    const long = "あ".repeat(MAX_EXPLANATION_CHARS + 5000);
    const prompt = buildExplanationPrompt({
      bill: { ...BILL, explanationSource: long },
      difficulty: "hard",
    });
    const body = prompt.split("<explanation>")[1].split("</explanation>")[0];
    expect(body.trim().length).toBe(MAX_EXPLANATION_CHARS);
  });
});
