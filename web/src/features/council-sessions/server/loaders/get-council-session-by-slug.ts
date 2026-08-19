import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { CouncilSession } from "../../shared/types";
import { findCouncilSessionBySlug } from "../repositories/council-session-repository";

/**
 * slugで国会会期を取得
 */
export async function getCouncilSessionBySlug(
  slug: string
): Promise<CouncilSession | null> {
  return _getCachedCouncilSessionBySlug(slug);
}

const _getCachedCouncilSessionBySlug = unstable_cache(
  async (slug: string): Promise<CouncilSession | null> => {
    return findCouncilSessionBySlug(slug);
  },
  ["council-session-by-slug"],
  {
    revalidate: 3600, // 1時間
    tags: [CACHE_TAGS.COUNCIL_SESSIONS],
  }
);
