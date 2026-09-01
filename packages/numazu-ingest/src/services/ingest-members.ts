import { DiscussVisionClient } from "../fetchers/discussvision-client";
import {
  upsertCouncilMember,
  upsertFaction,
} from "../repositories/ingest-repository";

/** 議員名の末尾の敬称・肩書を落とす（"浅原和美議員" -> "浅原和美"）。 */
export function stripHonorific(label: string): string {
  return label.replace(/(議員|議長|副議長|市長|副市長)$/, "").trim();
}

/**
 * 議会中継システムから会派と議員を取り込む。
 *
 * 議員の電話番号・自宅住所は市のサイトに載っているが、本サービスでは扱わない。
 * ここで取るのは氏名・かな・会派・顔写真のみ。
 *
 * 注意: このAPIが返すのは「中継の録画に登場したことのある議員・会派」であり、
 * 現職とは限らない（既に解散した会派や前期の議員も含まれる）。
 * したがって会派の現員数はここでは決めず、議会だよりの賛否表など
 * 現職を確定できる資料から別途埋める。
 */
export async function ingestMembers(
  options: { client?: DiscussVisionClient } = {}
): Promise<{ factionCount: number; memberCount: number }> {
  const client = options.client ?? new DiscussVisionClient();

  const groups = await client.getGroupMembers();
  const speakers = await client.getSpeakers();

  // speaker_id -> かな・顔写真 を引けるようにしておく
  const speakerById = new Map(
    speakers.speaker_list.map((speaker) => [speaker.speaker_id, speaker])
  );

  let memberCount = 0;
  for (const [index, group] of groups.entries()) {
    const factionId = await upsertFaction({
      name: group.label,
      externalGroupId: group.value,
      // 現員数はここでは分からない（過去の登壇者を含むため）。null のままにする
      memberCount: null,
      displayOrder: index,
    });

    for (const entry of group.lists) {
      const speaker = speakerById.get(entry.value);
      await upsertCouncilMember({
        name: stripHonorific(speaker?.name ?? entry.label),
        nameKana: speaker?.name_kana ?? null,
        externalSpeakerId: entry.value,
        factionId,
        photoUrl: speaker?.picture_name ?? null,
      });
      memberCount += 1;
    }
  }

  return { factionCount: groups.length, memberCount };
}
