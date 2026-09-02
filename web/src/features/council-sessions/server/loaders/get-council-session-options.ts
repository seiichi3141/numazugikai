import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  type CouncilSessionOption,
  findCouncilSessionOptions,
} from "../repositories/council-session-repository";

/** 議案一覧の「定例会」絞り込みに出す会期（新しい順） */
export async function getCouncilSessionOptions(): Promise<
  CouncilSessionOption[]
> {
  return _getCachedCouncilSessionOptions();
}

const _getCachedCouncilSessionOptions = unstable_cache(
  findCouncilSessionOptions,
  ["council-session-options"],
  {
    revalidate: 3600, // 1時間
    tags: [CACHE_TAGS.COUNCIL_SESSIONS],
  }
);
