"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { routes } from "@/lib/routes";
import {
  classifyGeneralQuestionItem,
  publishGeneralQuestionClassificationRelease,
} from "../repositories/general-question-qa-repository";

export async function classifyGeneralQuestion(formData: FormData) {
  const admin = await requireAdmin();
  const itemRevisionId = formData.get("itemRevisionId");
  const topicIds = formData
    .getAll("topicId")
    .filter((value): value is string => typeof value === "string");
  if (
    typeof itemRevisionId !== "string" ||
    !itemRevisionId ||
    !topicIds.length
  ) {
    throw new Error("質問項目と政策分野を選択してください");
  }
  await classifyGeneralQuestionItem({
    itemRevisionId,
    topicIds,
    reviewedBy: admin.id,
  });
  revalidatePath(routes.generalQuestionsQa());
}

export async function publishGeneralQuestionRelease(formData: FormData) {
  const admin = await requireAdmin();
  const releaseKey = formData.get("releaseKey");
  if (typeof releaseKey !== "string" || !releaseKey.trim()) {
    throw new Error("releaseキーを入力してください");
  }
  await publishGeneralQuestionClassificationRelease({
    releaseKey: releaseKey.trim(),
    reviewedBy: admin.id,
  });
  revalidatePath(routes.generalQuestionsQa());
}
