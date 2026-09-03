"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import { routes } from "@/lib/routes";
import {
  applyGeneralQuestionQaRow,
  refreshGeneralQuestionBatch,
  reviewGeneralQuestionQaRow,
} from "../repositories/general-question-qa-repository";

export async function reviewGeneralQuestion(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id");
  const decision = formData.get("decision");
  const reviewNote = formData.get("reviewNote");
  const reviewedHeldOn = formData.get("reviewedHeldOn");
  const reviewedMatchedAppearanceId = formData.get(
    "reviewedMatchedAppearanceId"
  );
  if (typeof id !== "string" || !id) throw new Error("対象IDが不正です");
  if (decision !== "verified" && decision !== "rejected") {
    throw new Error("確認結果が不正です");
  }
  if (
    decision === "verified" &&
    typeof reviewedHeldOn === "string" &&
    reviewedHeldOn !== "" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(reviewedHeldOn)
  ) {
    throw new Error("開催日が不正です");
  }
  if (
    typeof reviewedMatchedAppearanceId === "string" &&
    reviewedMatchedAppearanceId !== "" &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      reviewedMatchedAppearanceId
    )
  ) {
    throw new Error("突合先の登壇枠IDが不正です");
  }
  await reviewGeneralQuestionQaRow({
    id,
    qaStatus: decision,
    reviewNote:
      typeof reviewNote === "string" && reviewNote.trim()
        ? reviewNote.trim()
        : null,
    reviewedHeldOn:
      typeof reviewedHeldOn === "string" && reviewedHeldOn
        ? reviewedHeldOn
        : null,
    reviewedMatchedAppearanceId:
      typeof reviewedMatchedAppearanceId === "string" &&
      reviewedMatchedAppearanceId
        ? reviewedMatchedAppearanceId
        : null,
    reviewedBy: admin.id,
  });
  if (decision === "verified") {
    await applyGeneralQuestionQaRow({ id, reviewedBy: admin.id });
  }
  await refreshGeneralQuestionBatch({ id, reviewedBy: admin.id });
  revalidatePath(routes.generalQuestionsQa());
}

export async function applyGeneralQuestion(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("対象IDが不正です");
  await applyGeneralQuestionQaRow({ id, reviewedBy: admin.id });
  await refreshGeneralQuestionBatch({ id, reviewedBy: admin.id });
  revalidatePath(routes.generalQuestionsQa());
}
