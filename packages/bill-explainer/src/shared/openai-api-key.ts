/** OpenAI API を直接呼ぶためのキー。無ければ何をすべきか分かる形で止める。 */
export function requireOpenAiApiKey(purpose: string): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      `OPENAI_API_KEY が設定されていない。${purpose}は OpenAI API を直接呼ぶ`
    );
  }
  return apiKey;
}
