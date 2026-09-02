import {
  checkSystemDailyCostLimit,
  checkSystemMonthlyCostLimit,
} from "@/features/chat/server/services/system-cost-guard";
import { chatErrorToResponse } from "@/features/chat/server/utils/chat-error-response";
import { getChatSupabaseUser } from "@/features/chat/server/utils/supabase-server";
import {
  INTERVIEW_COLLECTION_ENABLED,
  INTERVIEW_UNAVAILABLE_MESSAGE,
} from "@/features/interview-config/shared/constants";
import { handleInterviewChatRequest } from "@/features/interview-session/server/services/handle-interview-chat-request";
import { jsonResponse } from "@/lib/api/response";
import { registerNodeTelemetry } from "@/lib/telemetry/register";

// Vercel の関数実行時間。Hobby プランは既定 10 秒で、AI の返答（推論モデル）は
// それを超える。60 秒は Hobby で Fluid compute 無しでも指定できる上限。
// Fluid compute を有効にした場合は 300 秒まで上げられる（デプロイ手順書参照）。
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!INTERVIEW_COLLECTION_ENABLED) {
    return jsonResponse({ error: INTERVIEW_UNAVAILABLE_MESSAGE }, 404);
  }

  // Vercel node環境でinstrumentationが自動で起動しない問題対応
  // 明示的にtelemetryを初期化
  await registerNodeTelemetry();

  const body = await req.json();
  const {
    messages,
    billId,
    currentStage,
    isRetry,
    previewToken,
  }: {
    messages: Array<{ role: string; content: string }>;
    billId: string;
    currentStage: "chat" | "summary" | "summary_complete";
    isRetry?: boolean;
    previewToken?: unknown;
  } = body;

  const {
    data: { user },
    error: getUserError,
  } = await getChatSupabaseUser();

  if (getUserError || !user) {
    return jsonResponse({ error: "Anonymous session required" }, 401);
  }

  if (!billId) {
    return jsonResponse({ error: "billId is required" }, 400);
  }

  try {
    // システム全体の予算上限チェック（日次・月次）
    await checkSystemDailyCostLimit();
    await checkSystemMonthlyCostLimit();

    return await handleInterviewChatRequest({
      messages,
      billId,
      currentStage,
      isRetry,
      // 文字列以外は検証対象にしない（不正な型のトークンは未指定として扱う）
      previewToken: typeof previewToken === "string" ? previewToken : undefined,
      userId: user.id,
    });
  } catch (error) {
    console.error("Interview chat request error:", error);
    return chatErrorToResponse(error);
  }
}
