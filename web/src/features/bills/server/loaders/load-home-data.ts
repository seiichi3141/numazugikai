import { getBillsByFeaturedTags } from "@/features/bills/server/loaders/get-bills-by-featured-tags";
import { loadComingSoonBillsWhenEnabled } from "@/features/bills/shared/utils/load-coming-soon-bills-when-enabled";
import { getLatestRegularCouncilSession } from "@/features/council-sessions/server/loaders/get-latest-regular-council-session";
import { getComingSoonBills } from "./get-coming-soon-bills";
import { getFeaturedBills } from "./get-featured-bills";

/**
 * トップページ用のデータを並列取得する
 * BFF (Backend For Frontend) パターン
 */
export async function loadHomeData(options: { includeComingSoon: boolean }) {
  const latestRegularSession = await getLatestRegularCouncilSession();
  if (!latestRegularSession) {
    return {
      latestRegularSession: null,
      billsByTag: [],
      featuredBills: [],
      comingSoonBills: await loadComingSoonBillsWhenEnabled({
        enabled: options.includeComingSoon,
        load: async () => [],
      }),
    };
  }

  const [featuredBills, billsByTag, comingSoonBills] = await Promise.all([
    getFeaturedBills(latestRegularSession.id),
    getBillsByFeaturedTags(latestRegularSession.id),
    loadComingSoonBillsWhenEnabled({
      enabled: options.includeComingSoon,
      load: () => getComingSoonBills(latestRegularSession.id),
    }),
  ]);

  return {
    latestRegularSession,
    billsByTag,
    featuredBills,
    comingSoonBills,
  };
}
