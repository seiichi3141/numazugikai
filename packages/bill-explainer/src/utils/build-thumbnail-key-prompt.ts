import { BILL_THUMBNAIL_SUBJECTS } from "@mirai-gikai/shared/bill-thumbnail/subjects";

/** 題材を決めるために渡す議案の情報。解説の要約があればそれを主に使う。 */
export type ThumbnailKeyInput = {
  name: string;
  categoryLabel: string | null;
  title: string | null;
  summary: string | null;
};

/**
 * 議案に合うサムネイルの題材を選ばせるプロンプト。
 *
 * 題材の一覧と説明をそのまま渡し、key を1つだけ返させる。
 * 説明文が無い議案でも正式名称と分類だけで選べるようにする。
 */
export function buildThumbnailKeyPrompt(bill: ThumbnailKeyInput): string {
  const subjects = BILL_THUMBNAIL_SUBJECTS.map(
    (subject) => `- ${subject.key}: ${subject.label} — ${subject.description}`
  ).join("\n");

  const facts = [
    `正式名称: ${bill.name}`,
    bill.categoryLabel ? `分類: ${bill.categoryLabel}` : null,
    bill.title ? `タイトル: ${bill.title}` : null,
    bill.summary ? `要約: ${bill.summary}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return `あなたは沼津市議会の議案に、内容を表す画像の題材を割り当てる担当です。
次の議案に最も近い題材を、一覧から1つだけ選んでください。

## 題材の一覧（key: 名前 — 当てはまる議案）
${subjects}

## 選び方
- 議案が「何についての話か」で選ぶ。手続きの種類（専決処分、契約、条例改正）より内容を優先する。
  例: 学校の工事請負契約は contract ではなく school-building。
- どれにも当てはまらなければ general。

## 議案
${facts}`;
}
