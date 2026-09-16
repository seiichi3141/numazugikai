export const GENERAL_QUESTION_SUMMARY_PROMPT_VERSION = "2026-09-04-v1";
export const GENERAL_QUESTION_SUMMARY_MAX_LENGTH = 120;

export type GeneralQuestionSourceItem = {
  sourceKey: string;
  label: string;
  parentSourceKey: string | null;
};

export function buildGeneralQuestionSummaryPrompt(input: {
  councilName: string;
  speakerName: string;
  items: GeneralQuestionSourceItem[];
}): string {
  const sourceItems = input.items
    .map(
      (item) =>
        `- sourceKey: ${item.sourceKey}\n  parentSourceKey: ${item.parentSourceKey ?? "なし"}\n  原文見出し: ${item.label}`
    )
    .join("\n");
  return `あなたは${input.councilName}の一般質問項目を、公開画面向けに要約します。

登壇者: ${input.speakerName}

## タスク
各項目について、原文見出しの意味を保った簡潔な日本語の要約を作成してください。

## 厳守事項
- 入力にない事実、意図、評価、賛否、因果関係を追加しない
- 固有名詞、数値、対象範囲を推測で補わない
- 議員や市の立場を断定しない
- 原文をそのまま長く転載せず、独立した短い表現に言い換える
- 親子関係を踏まえつつ、各項目だけでも意味が通じる表現にする
- sourceKeyは変更せず、入力項目ごとに必ず1件だけ返す
- summaryは${GENERAL_QUESTION_SUMMARY_MAX_LENGTH}文字以内、Markdownなし

## 入力項目
${sourceItems}`;
}

export function validateGeneratedSummaries(
  sourceItems: GeneralQuestionSourceItem[],
  generated: Array<{ sourceKey: string; summary: string }>
): Record<string, string> {
  const expectedKeys = new Set(sourceItems.map((item) => item.sourceKey));
  const summaries: Record<string, string> = {};
  for (const item of generated) {
    const summary = item.summary.trim();
    if (!expectedKeys.has(item.sourceKey)) {
      throw new Error(`生成結果に不明な項目キーがあります: ${item.sourceKey}`);
    }
    if (summaries[item.sourceKey] !== undefined) {
      throw new Error(`生成結果の項目キーが重複しています: ${item.sourceKey}`);
    }
    if (!summary || summary.length > GENERAL_QUESTION_SUMMARY_MAX_LENGTH) {
      throw new Error(`生成要約の長さが不正です: ${item.sourceKey}`);
    }
    summaries[item.sourceKey] = summary;
  }
  for (const key of expectedKeys) {
    if (summaries[key] === undefined) {
      throw new Error(`生成結果に項目がありません: ${key}`);
    }
  }
  return summaries;
}
