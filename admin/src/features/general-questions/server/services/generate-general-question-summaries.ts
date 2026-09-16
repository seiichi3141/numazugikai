import "server-only";

import {
  buildGeneralQuestionSummaryPrompt,
  type GeneralQuestionSourceItem,
  validateGeneratedSummaries,
} from "../../shared/utils/general-question-summary";

export type GeneralQuestionSummaryGenerator = (input: {
  prompt: string;
}) => Promise<Array<{ sourceKey: string; summary: string }>>;

export async function generateGeneralQuestionSummaries(input: {
  councilName: string;
  speakerName: string;
  items: GeneralQuestionSourceItem[];
  generator: GeneralQuestionSummaryGenerator;
}): Promise<Record<string, string>> {
  if (input.items.length === 0) return {};
  const generated = await input.generator({
    prompt: buildGeneralQuestionSummaryPrompt(input),
  });
  return validateGeneratedSummaries(input.items, generated);
}
