import { z } from "zod";

/**
 * 議案解説の生成結果。DB の bill_contents の title / summary / content に対応する。
 */
export const billExplanationSchema = z.object({
  /**
   * 市民向けの分かりやすいタイトル。
   *
   * 正式名称（「沼津市印鑑条例の一部改正」）とは別に、
   * 何が変わるのかが一目で分かる言い換えを置く。
   */
  title: z
    .string()
    .min(6)
    .max(60)
    .describe(
      "議案の内容が一目で分かる言い換えタイトル。40文字以内を目安にする。" +
        "「〜条例の一部改正」のような正式名称の繰り返しにはしない"
    ),
  /** 一覧カードに出る短い要約 */
  summary: z
    .string()
    .min(20)
    .max(200)
    .describe(
      "この議案で何がどう変わるのかを1〜2文で。100文字前後を目安にする"
    ),
  /** 詳細ページに出す本文（Markdown） */
  content: z
    .string()
    .min(100)
    .describe(
      "議案の解説本文。Markdownの見出し（##）と箇条書きを使って構成する"
    ),
});

export type BillExplanation = z.infer<typeof billExplanationSchema>;
