import {
  AmivoiceClient,
  buildAmivoiceMinutesUrl,
} from "../fetchers/amivoice-client";
import { buildSessionSlug } from "../parsers/map-bill-status";
import { parseAmivoiceSessionLabel } from "../parsers/parse-amivoice-html";
import { extractCommitteeBillReviews } from "../parsers/parse-committee-minutes";
import {
  extractBillExplanations,
  extractDebates,
} from "../parsers/parse-minutes";
import {
  buildMemberIdByName,
  findBillIdsBySession,
  findCouncilSessionIdBySlug,
  listCouncilSessionPeriods,
  updateBillCommitteeReview,
  updateBillExplanationIfLonger,
  upsertBillDebate,
} from "../repositories/ingest-repository";

export type IngestAmivoiceResult = {
  label: string;
  kind: "session" | "committee";
  meetingCount: number;
  explanationCount: number;
  debateCount: number;
  committeeReviewCount: number;
};

/**
 * 会議記録検索システム（AmiVoice）から、議案の詳細を取り込む。
 *
 * - 本会議の会議記録: 当局の議案説明と討論。議会中継より公開が早く、
 *   直近の定例会もここから読める
 * - 委員会の会議記録: 課長級による議案ごとの具体的な説明と、委員の質疑。
 *   市の公開資料の中で最も「議案が何をするものか」を語っている
 *
 * 会議記録の全文は保存しない。議案ごとの説明の切り出しと、討論・質疑の
 * 事実（誰が・どの立場で・何回）のみを保存し、原文は閲覧ページへリンクする。
 */
export async function ingestAmivoiceMinutes(
  options: { client?: AmivoiceClient } = {}
): Promise<IngestAmivoiceResult[]> {
  const client = options.client ?? new AmivoiceClient();
  const sessions = await client.listSessions();
  const periods = await listCouncilSessionPeriods();
  const memberIdByName = await buildMemberIdByName();

  const results: IngestAmivoiceResult[] = [];

  for (const session of sessions) {
    if (session.kind === "session") {
      const result = await ingestPlenary(client, session, memberIdByName);
      if (result) results.push(result);
    } else {
      results.push(await ingestCommittee(client, session, periods));
    }
  }

  return results;
}

type SessionPeriod = {
  id: string;
  startDate: string;
  endDate: string;
};

/** 本会議の会議記録: 議案説明と討論を取り込む。 */
async function ingestPlenary(
  client: AmivoiceClient,
  session: { vcsm: string; label: string; kind: "session" | "committee" },
  memberIdByName: ReadonlyMap<string, string>
): Promise<IngestAmivoiceResult | null> {
  const parsedLabel = parseAmivoiceSessionLabel(session.label);
  if (!parsedLabel) return null;

  const slug = buildSessionSlug(parsedLabel.year, parsedLabel.sessionNumber);
  const councilSessionId = await findCouncilSessionIdBySlug(slug);
  // 会期がまだDBにない（議案の取り込みが先）場合はスキップする
  if (!councilSessionId) return null;

  const billIdByNumber = await findBillIdsBySession(councilSessionId);
  const meetings = await client.listMeetings(session.vcsm);

  let explanationCount = 0;
  let debateCount = 0;

  for (const meeting of meetings) {
    const text = await client.getMinutesText(meeting.vcsv);
    if (!text) continue;
    const sourceUrl = buildAmivoiceMinutesUrl(meeting.vcsv);

    for (const explanation of extractBillExplanations(text)) {
      const billId = billIdByNumber.get(explanation.billNumber);
      if (!billId) continue;
      const updated = await updateBillExplanationIfLonger(
        billId,
        explanation.body
      );
      if (updated) explanationCount += 1;
    }

    for (const debate of extractDebates(text)) {
      const billId = billIdByNumber.get(debate.billNumber);
      if (!billId) continue;
      await upsertBillDebate({
        billId,
        speakerName: debate.speakerName,
        seatNumber: debate.seatNumber,
        councilMemberId:
          memberIdByName.get(debate.speakerName.replace(/[\s　]/g, "")) ?? null,
        stance: debate.stance,
        sourceUrl,
      });
      debateCount += 1;
    }
  }

  return {
    label: session.label,
    kind: "session",
    meetingCount: meetings.length,
    explanationCount,
    debateCount,
    committeeReviewCount: 0,
  };
}

/**
 * 委員会の会議記録: 議案ごとの審査（課長説明・質疑回数）を取り込む。
 *
 * 議案番号は年度をまたいで重複するため、会議の開催日が会期内にある
 * 定例会・臨時会の議案とだけ突合する。会期外（閉会中審査）はスキップする。
 */
async function ingestCommittee(
  client: AmivoiceClient,
  committee: { vcsm: string; label: string },
  periods: readonly SessionPeriod[]
): Promise<IngestAmivoiceResult> {
  const meetings = await client.listMeetings(committee.vcsm);
  let committeeReviewCount = 0;
  let processedMeetings = 0;

  for (const meeting of meetings) {
    // 開催日を含む会期をすべて候補にする。期間が重なる会期が
    // あっても、議案番号が実在する方で突合できるようにする
    const matchedPeriods = periods.filter(
      (candidate) =>
        meeting.date >= candidate.startDate && meeting.date <= candidate.endDate
    );
    if (matchedPeriods.length === 0) continue;

    processedMeetings += 1;
    const billMaps: ReadonlyMap<string, string>[] = [];
    for (const period of matchedPeriods) {
      billMaps.push(await findBillIdsBySession(period.id));
    }
    const text = await client.getMinutesText(meeting.vcsv);
    if (!text) continue;

    const minutesUrl = buildAmivoiceMinutesUrl(meeting.vcsv);
    for (const review of extractCommitteeBillReviews(text)) {
      for (const billNumber of review.billNumbers) {
        const billId = billMaps.map((map) => map.get(billNumber)).find(Boolean);
        if (!billId) continue;
        await updateBillCommitteeReview(billId, {
          qaCount: review.questionCount,
          minutesUrl,
        });
        if (review.explanation) {
          await updateBillExplanationIfLonger(billId, review.explanation);
        }
        committeeReviewCount += 1;
      }
    }
  }

  return {
    label: committee.label,
    kind: "committee",
    meetingCount: processedMeetings,
    explanationCount: 0,
    debateCount: 0,
    committeeReviewCount,
  };
}

export type IngestArchiveResult = {
  year: number;
  /** 検索で見つかった会議記録の数 */
  found: number;
  /** 会期と突合できて審査を保存できた議案の数 */
  reviewCount: number;
  /** 会期の期間に当てはまらず捨てた会議記録の数 */
  outOfSession: number;
};

/**
 * 会議記録検索から、過去の委員会記録を補完的に取り込む。
 *
 * トップページ（listSessions）は直近しか載せないため、古い年はこちらで拾う。
 * ただし2015〜2025年に収録されているのは文教消防・文教産業委員会だけで、
 * 他の常任委員会と本会議は検索経由では取れない（調査ノート参照）。
 * 網羅は期待せず、取れるものを取る用途に使う。
 */
export async function ingestAmivoiceArchive(params: {
  /** 取り込む年（西暦） */
  years: readonly number[];
  /** 検索語。既定は空（期間内の全件）。指定すると絞り込まれ取りこぼす */
  word?: string;
  client?: AmivoiceClient;
}): Promise<IngestArchiveResult[]> {
  const client = params.client ?? new AmivoiceClient();
  const periods = await listCouncilSessionPeriods();
  const results: IngestArchiveResult[] = [];

  for (const year of params.years) {
    const { hits } = await client.searchMinutes({
      word: params.word,
      range: { from: new Date(year, 0, 1), to: new Date(year, 11, 31) },
    });

    let reviewCount = 0;
    let outOfSession = 0;

    for (const hit of hits) {
      // 会議記録の開催日を含む会期を探す。閉会中審査など会期外の記録は
      // どの議案に紐づくか決められないので取り込まない
      const matched = periods.filter(
        (p) => hit.date >= p.startDate && hit.date <= p.endDate
      );
      if (matched.length === 0) {
        outOfSession += 1;
        continue;
      }

      const text = await client.getMinutesText(hit.vcsv);
      if (!text) continue;

      const billMaps: ReadonlyMap<string, string>[] = [];
      for (const period of matched) {
        billMaps.push(await findBillIdsBySession(period.id));
      }
      const minutesUrl = buildAmivoiceMinutesUrl(hit.vcsv);

      for (const review of extractCommitteeBillReviews(text)) {
        for (const billNumber of review.billNumbers) {
          const billId = billMaps.map((m) => m.get(billNumber)).find(Boolean);
          if (!billId) continue;
          await updateBillCommitteeReview(billId, {
            qaCount: review.questionCount,
            minutesUrl,
          });
          if (review.explanation) {
            await updateBillExplanationIfLonger(billId, review.explanation);
          }
          reviewCount += 1;
        }
      }
    }

    console.log(
      `${year}年: 会議記録${hits.length}件 → 審査${reviewCount}件（会期外 ${outOfSession}件）`
    );
    results.push({
      year,
      found: hits.length,
      reviewCount,
      outOfSession,
    });
  }

  return results;
}
