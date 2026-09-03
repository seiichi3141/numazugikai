import {
  generalQuestionsToCsv,
  getOpenDataGeneralQuestions,
} from "@/features/open-data/server/services/get-open-data-general-questions";
import { checkRateLimit } from "@/features/open-data/server/utils/rate-limit-guard";
import { parseGeneralQuestionsQuery } from "@/features/open-data/shared/utils/parse-general-questions-query";
import { jsonNoStore } from "@/lib/api/response";

export async function GET(request: Request) {
  const query = parseGeneralQuestionsQuery(new URL(request.url).searchParams);
  if (!query.ok) return jsonNoStore({ error: query.error }, 400);
  try {
    const rateLimited = await checkRateLimit(request);
    if (rateLimited) return rateLimited;
    const result = await getOpenDataGeneralQuestions(query);
    if (query.format === "csv") {
      return new Response(generalQuestionsToCsv(result.items), {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="general-questions.csv"',
        },
      });
    }
    return jsonNoStore(result);
  } catch (error) {
    console.error("[OpenData] general questions read failed:", error);
    return jsonNoStore({ error: "サーバー内部でエラーが発生しました" }, 500);
  }
}
