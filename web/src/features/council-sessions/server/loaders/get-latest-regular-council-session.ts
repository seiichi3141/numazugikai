import "server-only";

import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { CouncilSession } from "../../shared/types";
import { findLatestRegularCouncilSession } from "../repositories/council-session-repository";

/** トップページの議案表示対象となる、議案を持つ最新の定例会を返す。 */
export async function getLatestRegularCouncilSession(): Promise<CouncilSession | null> {
  try {
    return await _getCachedLatestRegularCouncilSession();
  } catch (error) {
    // 一時的なDB障害を「定例会なし」として1時間キャッシュしない。
    console.error("Failed to fetch latest regular council session:", error);
    return null;
  }
}

const _getCachedLatestRegularCouncilSession = unstable_cache(
  async (): Promise<CouncilSession | null> => {
    return findLatestRegularCouncilSession();
  },
  ["latest-regular-council-session"],
  {
    revalidate: 3600,
    tags: [CACHE_TAGS.COUNCIL_SESSIONS, CACHE_TAGS.BILLS],
  }
);
