import {
  buildCouncilWatchUrl,
  DiscussVisionClient,
} from "../fetchers/discussvision-client";
import {
  extractBillExplanations,
  extractDebates,
} from "../parsers/parse-minutes";
import {
  buildMemberIdByName,
  findBillIdsByNumberForSessions,
  updateBillExplanation,
  upsertBillDebate,
} from "../repositories/ingest-repository";
import type { Council } from "../shared/discussvision-schemas";

/**
 * 会議録を取りに行く価値のある日程かどうかを、発言の見出しから判断する。
 *
 * 会議録は会期ごとに数十の発言に分かれており、全部を取ると相手サイトへの
 * 負荷が大きい。議案説明・質疑・討論を含む発言だけに絞る。
 */
const RELEVANT_HEADING = /議案説明|議案質疑|討論|採決|委員長報告/;

export type IngestMinutesResult = {
  councilLabel: string;
  /** 会議録が未整備で取得できなかった発言の数 */
  unavailable: number;
  explanationCount: number;
  debateCount: number;
};

/**
 * 議会中継システムの会議録から、議案ごとの当局説明と討論を取り込む。
 *
 * 沼津市議会では市長提出議案のほとんどが可決されるため、議決結果だけでは
 * 議案の中身も、議論があったかどうかも分からない。会議録がその両方を埋める。
 *
 * 会議録の全文は保存しない。当該議案の説明部分を切り出して `explanation_source`
 * に、討論は「誰がどの立場で discussed したか」という事実だけを保存し、
 * 原文は公式の再生ページへリンクする。
 */
export async function ingestMinutesForCouncil(params: {
  council: Council;
  /** 突合対象の会期ID。会議録の議案番号からこの会期の議案を引く */
  councilSessionIds: readonly string[];
  client?: DiscussVisionClient;
}): Promise<IngestMinutesResult> {
  const client = params.client ?? new DiscussVisionClient();
  const billIdByNumber = await findBillIdsByNumberForSessions(
    params.councilSessionIds
  );
  const memberIdByName = await buildMemberIdByName();

  let unavailable = 0;
  let explanationCount = 0;
  let debateCount = 0;

  for (const schedule of params.council.schedules) {
    for (const item of schedule.playlist) {
      if (!RELEVANT_HEADING.test(item.content ?? "")) continue;

      const text = await client
        .getMinuteText(
          params.council.council_id,
          schedule.schedule_id,
          item.playlist_id
        )
        .catch(() => "");

      // 直近の会期は会議録の作成が間に合っておらず、本文が返らないことがある
      if (!text) {
        unavailable += 1;
        continue;
      }

      const sourceUrl = buildCouncilWatchUrl(
        params.council.council_id,
        schedule.schedule_id,
        item.playlist_id
      );

      for (const explanation of extractBillExplanations(text)) {
        const billId = billIdByNumber.get(explanation.billNumber);
        if (!billId) continue;
        await updateBillExplanation(billId, explanation.body);
        explanationCount += 1;
      }

      for (const debate of extractDebates(text)) {
        const billId = billIdByNumber.get(debate.billNumber);
        if (!billId) continue;
        await upsertBillDebate({
          billId,
          speakerName: debate.speakerName,
          seatNumber: debate.seatNumber,
          councilMemberId:
            memberIdByName.get(debate.speakerName.replace(/[\s　]/g, "")) ??
            null,
          stance: debate.stance,
          sourceUrl,
        });
        debateCount += 1;
      }
    }
  }

  return {
    councilLabel: params.council.label,
    unavailable,
    explanationCount,
    debateCount,
  };
}

/**
 * 指定年のすべての会議について会議録を取り込む。
 *
 * 会議録は会期をまたいで議案番号が重複しうるため（令和7年度議案と8年度議案）、
 * 突合対象の会期は呼び出し側が渡す。
 */
export async function ingestMinutes(params: {
  year: number;
  councilSessionIds: readonly string[];
  client?: DiscussVisionClient;
}): Promise<IngestMinutesResult[]> {
  const client = params.client ?? new DiscussVisionClient();
  const councils = await client.getCouncils(params.year);

  const results: IngestMinutesResult[] = [];
  for (const council of councils) {
    results.push(
      await ingestMinutesForCouncil({
        council,
        councilSessionIds: params.councilSessionIds,
        client,
      })
    );
  }
  return results;
}
