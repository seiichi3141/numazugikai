import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { CouncilSessionSummary } from "../../shared/types";
import { findCouncilSessionsWithPublishedBillCounts } from "../repositories/council-session-repository";

/** 会期の一覧（公開済みの議案数つき、新しい順） */
export async function getCouncilSessions(): Promise<CouncilSessionSummary[]> {
  return _getCachedCouncilSessions();
}

const _getCachedCouncilSessions = unstable_cache(
  async (): Promise<CouncilSessionSummary[]> => {
    return findCouncilSessionsWithPublishedBillCounts();
  },
  ["council-sessions-with-bill-counts"],
  {
    revalidate: 3600, // 1時間
    // 議案の公開で件数が変わるので、両方のタグで無効化できるようにする
    tags: [CACHE_TAGS.COUNCIL_SESSIONS, CACHE_TAGS.BILLS],
  }
);
