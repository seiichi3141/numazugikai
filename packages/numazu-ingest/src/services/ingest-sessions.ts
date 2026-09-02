import { NumazuSiteClient } from "../fetchers/numazu-site-client";
import { buildSessionName, buildSessionSlug } from "../parsers/map-bill-status";
import { parseSessionScheduleHtml } from "../parsers/parse-session-schedule-html";
import {
  findContentHash,
  saveContentHash,
  upsertCouncilSession,
} from "../repositories/ingest-repository";
import { NUMAZU_SITE_URLS } from "../shared/constants-site";

const SOURCE = "schedule_html";

/**
 * 定例会会期予定ページから、各定例会の会期を取り込む。
 *
 * このページが会期の日付について最も正確なので、議案審議結果PDFから
 * 推定した日付があっても、こちらで上書きする。
 */
export async function ingestSessionSchedule(
  options: { force?: boolean; client?: NumazuSiteClient } = {}
): Promise<{ skipped: boolean; sessionCount: number }> {
  const client = options.client ?? new NumazuSiteClient();
  const url = NUMAZU_SITE_URLS.sessionSchedule;

  const fetched = await client.fetchHtml(url);
  const previousHash = await findContentHash(SOURCE, url);
  if (!options.force && previousHash === fetched.contentHash) {
    return { skipped: true, sessionCount: 0 };
  }

  const schedules = parseSessionScheduleHtml(fetched.text);
  for (const schedule of schedules) {
    const year = Number(schedule.startDate.slice(0, 4));
    const kind = schedule.label.includes("臨時")
      ? ("extraordinary" as const)
      : ("regular" as const);
    await upsertCouncilSession({
      name: buildSessionName({
        year,
        sessionNumber: schedule.sessionNumber,
        month: Number(schedule.startDate.slice(5, 7)),
        kind,
      }),
      slug: buildSessionSlug(year, schedule.sessionNumber),
      sessionNumber: schedule.sessionNumber,
      kind,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      sourceUrl: url,
    });
  }

  await saveContentHash({
    source: SOURCE,
    url,
    contentHash: fetched.contentHash,
    etag: fetched.etag,
    lastModified: fetched.lastModified,
  });

  return { skipped: false, sessionCount: schedules.length };
}
