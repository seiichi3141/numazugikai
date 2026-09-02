import "server-only";

/**
 * OpenAI API のキーを返す。
 *
 * 本サービスは OpenAI API を直接呼ぶ（Vercel AI Gateway は経由しない）。
 * 起動時ではなく呼び出し時に検証するのは、AIを使わないページのレンダリングを
 * キーの未設定で落とさないため。
 */
export function requireOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "環境変数 OPENAI_API_KEY が設定されていません。AIチャットとインタビューは OpenAI API を直接利用します"
    );
  }
  return apiKey;
}
