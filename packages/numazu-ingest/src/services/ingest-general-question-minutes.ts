import {
  AmivoiceClient,
  buildAmivoiceMinutesUrl,
} from "../fetchers/amivoice-client";
import { buildSessionName, buildSessionSlug } from "../parsers/map-bill-status";
import type { AmivoiceSearchHit } from "../parsers/parse-amivoice-search";
import { parseGeneralQuestionMinutes } from "../parsers/parse-general-question-minutes";
import {
  findPreviousGeneralQuestionAppearances,
  prepareGeneralQuestionMinutesSource,
  saveGeneralQuestionStaging,
} from "../repositories/general-question-ingest-repository";
import { ensureCouncilSession } from "../repositories/ingest-repository";
import { buildGeneralQuestionStagingRows } from "../shared/utils/build-general-question-staging";
import { groupAmivoiceSessionHits } from "../shared/utils/group-amivoice-session-hits";

export type IngestGeneralQuestionMinutesResult = {
  years: number[];
  searchedMeetingCount: number;
  generalQuestionMeetingCount: number;
  stagedAppearanceCount: number;
  skippedCount: number;
};

export interface GeneralQuestionMinutesClient {
  searchMinutes(params: {
    word?: string;
    range?: { from: Date; to: Date };
    meetingTypes?: readonly string[];
    maxPages?: number;
    requireComplete?: boolean;
  }): Promise<{ hitCount: number | null; hits: AmivoiceSearchHit[] }>;
  getMinutesText(vcsv: string): Promise<string>;
}

/**
 * 1990年以降のAmiVoice会議記録でPDF以前の登壇枠を補完する。
 * 本文はメモリ上で解析後に破棄し、DBにはハッシュ、公式URL、登壇・役職メタデータだけを残す。
 */
export async function ingestGeneralQuestionMinutes(params: {
  ingestionRunId: string;
  years: readonly number[];
  client?: GeneralQuestionMinutesClient;
}): Promise<IngestGeneralQuestionMinutesResult> {
  const client = params.client ?? new AmivoiceClient();
  const hits: AmivoiceSearchHit[] = [];
  for (const year of params.years) {
    const result = await client.searchMinutes({
      range: { from: new Date(year, 0, 1), to: new Date(year, 11, 31) },
      meetingTypes: ["001", "002"],
      requireComplete: true,
    });
    hits.push(...result.hits);
  }

  let generalQuestionMeetingCount = 0;
  let stagedAppearanceCount = 0;
  let skippedCount = 0;
  for (const group of groupAmivoiceSessionHits(hits)) {
    const dates = group.hits.map((hit) => hit.date).sort();
    const councilSessionId = await ensureCouncilSession({
      name: buildSessionName({
        year: group.year,
        sessionNumber: group.sessionNumber,
        month: Number(dates[0].slice(5, 7)),
        kind: group.kind,
      }),
      slug: buildSessionSlug(group.year, group.sessionNumber),
      sessionNumber: group.sessionNumber,
      kind: group.kind,
      startDate: dates[0],
      endDate: dates.at(-1) as string,
      sourceUrl: buildAmivoiceMinutesUrl(group.hits[0].vcsv),
    });

    for (const hit of group.hits) {
      const text = await client.getMinutesText(hit.vcsv);
      const appearances = parseGeneralQuestionMinutes({
        text,
        heldOn: hit.date,
        sourceKeyPrefix: hit.vcsv.replace(/\.vcsv$/, ""),
      });
      if (appearances.length === 0) continue;
      generalQuestionMeetingCount += 1;
      const url = buildAmivoiceMinutesUrl(hit.vcsv);
      const prepared = await prepareGeneralQuestionMinutesSource({
        ingestionRunId: params.ingestionRunId,
        url,
        sourceTitle: `${hit.meetingName} ${hit.date} 会議記録`,
        transientText: text,
      });
      if (prepared.alreadyParsed) {
        skippedCount += 1;
        continue;
      }
      const previous = await findPreviousGeneralQuestionAppearances(
        prepared.sourceId
      );
      const rows = buildGeneralQuestionStagingRows(appearances, previous);
      await saveGeneralQuestionStaging({
        sourceVersionId: prepared.sourceVersionId,
        parseRunId: prepared.parseRunId,
        councilSessionId,
        rows,
        discoveredCount: appearances.length,
        validationErrors: [],
      });
      stagedAppearanceCount += rows.length;
    }
  }
  return {
    years: [...params.years],
    searchedMeetingCount: hits.length,
    generalQuestionMeetingCount,
    stagedAppearanceCount,
    skippedCount,
  };
}
