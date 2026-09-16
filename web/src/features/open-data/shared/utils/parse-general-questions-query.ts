import { parsePaginationQuery } from "./parse-pagination-query";

export type GeneralQuestionsQuery = ReturnType<typeof parsePaginationQuery> & {
  session?: string;
  year?: number;
  questionKind?: string;
  topic?: string;
  role?: string;
  format?: "json" | "csv";
};

export function parseGeneralQuestionsQuery(
  searchParams: URLSearchParams
): GeneralQuestionsQuery {
  const pagination = parsePaginationQuery(searchParams);
  if (!pagination.ok) return pagination;
  const yearValue = searchParams.get("year");
  const year = yearValue === null ? undefined : Number(yearValue);
  if (
    year !== undefined &&
    (!Number.isInteger(year) || year < 1990 || year > 9999)
  ) {
    return { ok: false, error: "year は1990以降の西暦で指定してください" };
  }
  const formatValue = searchParams.get("format") ?? "json";
  if (formatValue !== "json" && formatValue !== "csv") {
    return { ok: false, error: "format は json または csv を指定してください" };
  }
  const questionKind = searchParams.get("questionKind") || undefined;
  if (
    questionKind !== undefined &&
    !["representative", "personal", "other", "unknown"].includes(questionKind)
  ) {
    return {
      ok: false,
      error:
        "questionKind は representative / personal / other / unknown のいずれかで指定してください",
    };
  }
  return {
    ...pagination,
    session: searchParams.get("session") || undefined,
    year,
    questionKind,
    topic: searchParams.get("topic") || undefined,
    role: searchParams.get("role") || undefined,
    format: formatValue,
  };
}
