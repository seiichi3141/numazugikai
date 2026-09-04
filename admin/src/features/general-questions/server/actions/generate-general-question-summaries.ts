"use server";

import { AI_MODELS } from "@mirai-gikai/shared/ai/models";
import { resolveOpenAiModel } from "@mirai-gikai/shared/ai/resolve-model";
import { generateObject } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { routes } from "@/lib/routes";
import { SITE_PROFILE } from "@/lib/site";
import {
  GENERAL_QUESTION_SUMMARY_MAX_LENGTH,
  GENERAL_QUESTION_SUMMARY_PROMPT_VERSION,
} from "../../shared/utils/general-question-summary";
import {
  findGeneralQuestionSummarySource,
  saveGeneratedGeneralQuestionSummaries,
} from "../repositories/general-question-qa-repository";
import { generateGeneralQuestionSummaries } from "../services/generate-general-question-summaries";

const SUMMARY_MODEL = AI_MODELS.gpt5_6_luna;
const SUMMARY_TIMEOUT_MS = 60_000;
const resultSchema = z.object({
  summaries: z.array(
    z.object({
      sourceKey: z.string(),
      summary: z.string().min(1).max(GENERAL_QUESTION_SUMMARY_MAX_LENGTH),
    })
  ),
});

export async function generateGeneralQuestionSummaryAction(
  formData: FormData
): Promise<void> {
  await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("対象IDが不正です");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY が設定されていない。一般質問要約はOpenAI APIを直接呼ぶ"
    );
  }
  const source = await findGeneralQuestionSummarySource(id);
  const summaries = await generateGeneralQuestionSummaries({
    ...source,
    councilName: SITE_PROFILE.jurisdiction.councilName,
    generator: async ({ prompt }) => {
      const result = await generateObject({
        model: resolveOpenAiModel(SUMMARY_MODEL, { apiKey }),
        schema: resultSchema,
        prompt,
        abortSignal: AbortSignal.timeout(SUMMARY_TIMEOUT_MS),
        experimental_telemetry: {
          isEnabled: true,
          functionId: "general-question-public-summary",
          metadata: { itemCount: String(source.items.length) },
        },
      });
      return result.object.summaries;
    },
  });
  await saveGeneratedGeneralQuestionSummaries({
    id,
    summaries,
    model: SUMMARY_MODEL,
    promptVersion: GENERAL_QUESTION_SUMMARY_PROMPT_VERSION,
  });
  revalidatePath(routes.generalQuestionsQa());
}
