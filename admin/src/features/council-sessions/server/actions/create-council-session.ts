"use server";

import { requireAdmin } from "@/features/auth/server/lib/auth-server";
import {
  invalidateWebCache,
  WEB_CACHE_TAGS,
} from "@/lib/utils/cache-invalidation";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import { trimOrNull } from "@/lib/utils/normalize-string";
import type { CreateCouncilSessionInput } from "../../shared/types";
import { validateDateRange } from "../../shared/utils/validate-date-range";
import { validateSlug } from "../../shared/utils/validate-slug";
import { createCouncilSessionRecord } from "../repositories/council-session-repository";

export async function createCouncilSession(input: CreateCouncilSessionInput) {
  try {
    await requireAdmin();

    // バリデーション
    if (!input.name || input.name.trim().length === 0) {
      return { error: "会期名を入力してください" };
    }

    if (!input.start_date) {
      return { error: "開始日を入力してください" };
    }

    if (!input.end_date) {
      return { error: "終了日を入力してください" };
    }

    const slugError = validateSlug(input.slug);
    if (slugError) {
      return { error: slugError };
    }

    const dateRangeError = validateDateRange(input.start_date, input.end_date);
    if (dateRangeError) {
      return { error: dateRangeError };
    }

    const data = await createCouncilSessionRecord({
      name: input.name.trim(),
      slug: trimOrNull(input.slug),
      source_url: trimOrNull(input.source_url),
      start_date: input.start_date,
      end_date: input.end_date,
    });

    await invalidateWebCache([WEB_CACHE_TAGS.COUNCIL_SESSIONS]);
    return { data };
  } catch (error) {
    console.error("Create council session error:", error);
    return {
      error: getErrorMessage(error, "会期の作成中にエラーが発生しました"),
    };
  }
}
