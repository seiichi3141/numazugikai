export type BillTagPromptInput = {
  name: string;
  categoryLabel: string | null;
  title: string | null;
  summary: string | null;
  explanationSource: string | null;
};

export type AvailableBillTag = {
  label: string;
  description: string | null;
};

const MAX_SOURCE_CHARS = 6_000;

/** DBに登録された分類だけを使って議案のテーマを判定させるプロンプトを作る。 */
export function buildBillTagPrompt(
  bill: BillTagPromptInput,
  tags: AvailableBillTag[]
): string {
  const tagList = tags
    .map(
      (tag) => `- ${tag.label}${tag.description ? `: ${tag.description}` : ""}`
    )
    .join("\n");
  const facts = [
    `正式名称: ${bill.name}`,
    bill.categoryLabel ? `議案種別: ${bill.categoryLabel}` : null,
    bill.title ? `市民向けタイトル: ${bill.title}` : null,
    bill.summary ? `要約: ${bill.summary}` : null,
    bill.explanationSource
      ? `原資料に基づく説明:\n${bill.explanationSource.slice(0, MAX_SOURCE_CHARS)}`
      : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return `あなたは沼津市議会の議案を、市民生活に関わるテーマで分類する担当です。
次の議案に当てはまるタグを、候補から重要な順に1〜3件選んでください。

## タグ候補
${tagList}

## 分類ルール
- 必ず候補にあるタグ名をそのまま返す。
- 条例、予算、契約などの手続きの種類ではなく、議案が扱う政策分野を優先する。
- 複数分野に実質的に関係する場合だけ複数を選ぶ。
- 名称が一般会計予算・決算などで個別分野を特定できない場合は、行財政を扱うタグを選ぶ。
- 与えられた情報だけで判断し、書かれていない内容を推測で補わない。

## 議案
${facts}`;
}
