import "server-only";

import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { CouncilSession } from "../../shared/types";
import { findLatestClosedCouncilSession } from "../repositories/council-session-repository";

/**
 * 指定日より前に閉会した直近の会期を取得する。
 *
 * 閉会中のトップページで「第○回国会は終了しました」を出すために使う。
 * `getPreviousCouncilSession` はアクティブ会期を起点にするため、閉会中は null に
 * なるか、ひとつ前の会期を返してしまう。
 */
export async function getLatestClosedCouncilSession(
  date: Date
): Promise<CouncilSession | null> {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return _getCachedLatestClosedCouncilSession(`${year}-${month}-${day}`);
}

const _getCachedLatestClosedCouncilSession = unstable_cache(
  async (onDate: string): Promise<CouncilSession | null> =>
    findLatestClosedCouncilSession(onDate),
  ["latest-closed-council-session"],
  { revalidate: 3600, tags: [CACHE_TAGS.COUNCIL_SESSIONS] }
);
