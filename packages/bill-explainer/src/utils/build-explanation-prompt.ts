import {
  type DifficultyLevel,
  MAX_EXPLANATION_CHARS,
} from "../shared/constants";

/** プロンプトに渡す議案の材料 */
export type BillExplanationInput = {
  /** 議案番号（例: 議第58号）。無ければ null */
  billNumber: string | null;
  /** 議案の正式名称 */
  name: string;
  /** 議案の分類（条例・予算など）の日本語ラベル。無ければ null */
  categoryLabel: string | null;
  /** 提出者の日本語ラベル（市長・議員など）。無ければ null */
  submitterLabel: string | null;
  /** 付託委員会の略称（例: 民生病院教育）。付託省略・無しは null */
  committee: string | null;
  /** 本会議の議決結果の日本語ラベル（例: 可決）。未議決は null */
  decisionLabel: string | null;
  /** 会議録から切り出した当局の議案説明 */
  explanationSource: string;
  /** 会期名（例: 令和8年第13回（6月）定例会） */
  sessionName: string | null;
};

const DIFFICULTY_GUIDANCE: Record<DifficultyLevel, string> = {
  normal: `## 読み手と書き方（やさしい版）
- 読み手は、市政に特別くわしくない沼津市民です。中学生が読んでも分かる言葉で書いてください
- 行政の言い回し（「〜に資する」「所要の改正」「鑑み」など）は、日常の言葉に置き換えてください
- 制度の名前を出すときは、それが何なのかを一言添えてください
- 本文は600〜900文字程度を目安にしてください`,
  hard: `## 読み手と書き方（くわしい版）
- 読み手は、市政に関心があり、背景まで知りたい沼津市民です
- 制度の仕組み、改正の経緯、金額や対象範囲などの具体を落とさずに書いてください
- 専門用語を使ってよいですが、初出時には短い説明を添えてください
- 本文は1000〜1600文字程度を目安にしてください`,
};

/**
 * 議案解説を書かせるプロンプトを組み立てる。
 *
 * 材料は市が公開している議案説明（会議録の当局説明）のみで、
 * モデルの一般知識で内容を補わせない。市議会の議案は市民生活に直結するため、
 * 事実でない説明を出すと市政への誤解に直結する。
 */
export function buildExplanationPrompt(params: {
  bill: BillExplanationInput;
  difficulty: DifficultyLevel;
}): string {
  const { bill, difficulty } = params;

  const facts = [
    bill.billNumber ? `議案番号: ${bill.billNumber}` : null,
    `正式名称: ${bill.name}`,
    bill.sessionName ? `会期: ${bill.sessionName}` : null,
    bill.categoryLabel ? `分類: ${bill.categoryLabel}` : null,
    bill.submitterLabel ? `提出者: ${bill.submitterLabel}` : null,
    bill.committee ? `付託委員会: ${bill.committee}委員会` : null,
    bill.decisionLabel ? `本会議の議決: ${bill.decisionLabel}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const source = bill.explanationSource.slice(0, MAX_EXPLANATION_CHARS);

  return `あなたは、沼津市議会の議案を市民に分かりやすく伝える解説者です。

${DIFFICULTY_GUIDANCE[difficulty]}

## 絶対に守ること

- **材料に書かれていないことは書かないでください。** 一般的な知識で内容を補ったり、
  「おそらく〜だろう」と推測したりしてはいけません。材料から読み取れることだけを書きます
- 金額・日付・対象範囲・施設名などの具体的な数値や固有名詞は、材料のとおりに正確に書いてください
- 議案への賛否や評価を書かないでください。「良い改正です」「問題があります」といった
  価値判断は解説者の役割ではありません。何が変わるのかを説明することに徹してください
- 材料が乏しく内容を説明しきれない場合は、分かる範囲だけを簡潔に書いてください。
  分量を満たすために内容を膨らませてはいけません
- 議員個人や会派の名前を出さないでください

## 書く内容

本文（content）は次の構成を基本にしてください。材料に該当する情報がない節は省いて構いません。

- \`## どんな議案か\` … 何をするものかを最初に述べる
- \`## 何が変わるのか\` … 現状からの変化を具体的に。箇条書きが有効なら使う
- \`## 市民の暮らしへの関わり\` … どんな人が、どんな場面で関係するのか。
  材料から読み取れる範囲に限り、想像で広げないこと

## 議案の情報

${facts}

## 議案説明（沼津市議会の会議録から抜き出したもの）

これがあなたに与えられた唯一の材料です。

<explanation>
${source}
</explanation>`;
}
