import { basename } from "node:path";
import { NumazuSiteClient } from "../fetchers/numazu-site-client";
import { buildSessionName, buildSessionSlug } from "../parsers/map-bill-status";
import { parseGeneralQuestionIndexHtml } from "../parsers/parse-general-question-index";
import { parseGeneralQuestionPdf } from "../parsers/parse-general-question-pdf";
import {
  findCouncilSessionForAppearances,
  findPreviousGeneralQuestionAppearances,
  prepareGeneralQuestionSource,
  saveGeneralQuestionStaging,
} from "../repositories/general-question-ingest-repository";
import { ensureCouncilSession } from "../repositories/ingest-repository";
import { buildReportTermUrl } from "../shared/constants-site";
import { getGeneralQuestionCurrentTermSources } from "../shared/general-question-current-term-sources";
import { buildGeneralQuestionStagingRows } from "../shared/utils/build-general-question-staging";
import { findMissingCurrentTermGeneralQuestionSources } from "../shared/utils/find-missing-current-term-general-question-sources";
import {
  getMonthDateRange,
  inferGeneralQuestionSessionNumber,
} from "../shared/utils/infer-general-question-session-number";

export type IngestGeneralQuestionsResult = {
  term: number;
  sourceCount: number;
  stagedBatchIds: string[];
  skippedCount: number;
  validationErrorCount: number;
};

/** 期ページで公開中の一般質問PDFを取得し、公開せずQAキューへ積む。 */
export async function ingestGeneralQuestionsForTerm(params: {
  ingestionRunId: string;
  term: number;
  client?: NumazuSiteClient;
}): Promise<IngestGeneralQuestionsResult> {
  const client = params.client ?? new NumazuSiteClient();
  const indexUrl = buildReportTermUrl(params.term);
  const index = await client.fetchHtml(indexUrl);
  const sources = parseGeneralQuestionIndexHtml(index.text, indexUrl);
  const currentExpectations = new Map(
    getGeneralQuestionCurrentTermSources().map((source) => [
      source.fileName,
      source,
    ])
  );
  const missingFileNames = findMissingCurrentTermGeneralQuestionSources(
    params.term,
    sources.map((source) => source.url)
  );
  if (missingFileNames.length > 0) {
    throw new Error(
      `現行期の一般質問資料が公式一覧から欠落しています: ${missingFileNames.join(", ")}`
    );
  }
  const stagedBatchIds: string[] = [];
  let skippedCount = 0;
  let validationErrorCount = 0;

  for (const source of sources) {
    const fetched = await client.fetchPdfDocument(source.url);
    const prepared = await prepareGeneralQuestionSource({
      ingestionRunId: params.ingestionRunId,
      fetched,
      sourceTitle: source.label,
    });
    if (prepared.alreadyParsed) {
      skippedCount += 1;
      continue;
    }
    const parsed = parseGeneralQuestionPdf(fetched.text);
    const expectation =
      params.term === 25
        ? currentExpectations.get(basename(new URL(source.url).pathname))
        : undefined;
    const topLevelItemCount = parsed.appearances.reduce(
      (count, appearance) =>
        count +
        appearance.items.filter((item) => item.parentSourceKey === null).length,
      0
    );
    const validationErrors: string[] = [];
    if (parsed.appearances.length === 0) {
      validationErrors.push("登壇枠を抽出できませんでした");
    }
    if (expectation) {
      if (parsed.appearances.length !== expectation.expectedAppearanceCount) {
        validationErrors.push(
          `登壇枠数: 期待${expectation.expectedAppearanceCount}件 / 抽出${parsed.appearances.length}件`
        );
      }
      if (topLevelItemCount !== expectation.expectedTopLevelItemCount) {
        validationErrors.push(
          `最上位項目数: 期待${expectation.expectedTopLevelItemCount}件 / 抽出${topLevelItemCount}件`
        );
      }
    }
    if (validationErrors.length > 0) {
      validationErrorCount += validationErrors.length;
    }
    let councilSessionId = await findCouncilSessionForAppearances(
      parsed.appearances
    );
    const dates = parsed.appearances
      .map((appearance) => appearance.heldOn)
      .filter((date): date is string => date !== null)
      .sort();
    if (dates.length === 0) dates.push(...parsed.sourceDates);
    const sourceMonth = Number(
      new URL(source.url).pathname.match(/(?:d-|k-)?\d{2}(\d{2})\.pdf$/)?.[1]
    );
    const sessionNumber =
      parsed.sessionNumber ??
      (parsed.sessionYear && sourceMonth
        ? inferGeneralQuestionSessionNumber(
            params.term,
            parsed.sessionYear,
            sourceMonth
          )
        : null);
    const inferredRange =
      dates.length === 0 && parsed.sessionYear && sourceMonth
        ? getMonthDateRange(parsed.sessionYear, sourceMonth)
        : null;
    if (
      !councilSessionId &&
      (dates.length > 0 || inferredRange) &&
      sessionNumber !== null
    ) {
      const year = parsed.sessionYear ?? Number(dates[0].slice(0, 4));
      const kind = parsed.sessionLabel?.includes("臨時")
        ? "extraordinary"
        : "regular";
      councilSessionId = await ensureCouncilSession({
        name:
          parsed.sessionNumber === null && parsed.sessionLabel
            ? parsed.sessionLabel
            : buildSessionName({
                year,
                sessionNumber,
                month: sourceMonth || Number(dates[0].slice(5, 7)),
                kind,
              }),
        slug: buildSessionSlug(year, sessionNumber),
        sessionNumber,
        kind,
        startDate: inferredRange?.startDate ?? dates[0],
        endDate: inferredRange?.endDate ?? (dates.at(-1) as string),
        sourceUrl: indexUrl,
      });
    }
    if (!councilSessionId) {
      validationErrors.push("会期を一意に突合できませんでした");
      validationErrorCount += 1;
    }
    const previous = await findPreviousGeneralQuestionAppearances(
      prepared.sourceId
    );
    const rows = buildGeneralQuestionStagingRows(parsed.appearances, previous);
    stagedBatchIds.push(
      await saveGeneralQuestionStaging({
        sourceVersionId: prepared.sourceVersionId,
        parseRunId: prepared.parseRunId,
        councilSessionId,
        rows,
        discoveredCount: parsed.appearances.length,
        validationErrors,
        parseStatus: parsed.appearances.length === 0 ? "failed" : "completed",
      })
    );
  }

  return {
    term: params.term,
    sourceCount: sources.length,
    stagedBatchIds,
    skippedCount,
    validationErrorCount,
  };
}
