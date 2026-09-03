/**
 * 議案解説の生成に使うモデル。
 *
 * Vercel AI Gateway ではなく OpenAI API を直接叩くため、
 * `openai/` の接頭辞は付けない。
 */
export const BILL_EXPLAINER_MODEL = "gpt-5.6-luna";

/** 1議案あたりの生成タイムアウト。長文の議案説明を扱うため余裕を持たせる。 */
export const BILL_EXPLAINER_TIMEOUT_MS = 120_000;

/**
 * 生成の難易度。
 *
 * `normal` は中学生でも読める平易な説明、`hard` は制度の背景まで踏み込んだ説明。
 * DB の difficulty_level_enum と対応する。
 */
export const DIFFICULTY_LEVELS = ["normal", "hard"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

/** モデルに渡す議案説明の最大文字数。委員会の詳細説明は長くなることがある。 */
export const MAX_EXPLANATION_CHARS = 12_000;

/** サムネイル題材の選択は短い出力なので、解説より短いタイムアウトで十分。 */
export const THUMBNAIL_KEY_TIMEOUT_MS = 60_000;

/** テーマタグの選択は短い構造化出力なので、解説より短いタイムアウトで十分。 */
export const BILL_TAG_TIMEOUT_MS = 60_000;
