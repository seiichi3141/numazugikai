import { getBillsByFeaturedTags } from "@/features/bills/server/loaders/get-bills-by-featured-tags";
import { getLatestRegularCouncilSession } from "@/features/council-sessions/server/loaders/get-latest-regular-council-session";
import { getComingSoonBills } from "./get-coming-soon-bills";
import { getFeaturedBills } from "./get-featured-bills";

/**
 * トップページ用のデータを並列取得する
 * BFF (Backend For Frontend) パターン
 */
export async function loadHomeData() {
  const latestRegularSession = await getLatestRegularCouncilSession();
  if (!latestRegularSession) {
    return {
      latestRegularSession: null,
      billsByTag: [],
      featuredBills: [],
      comingSoonBills: [],
    };
  }

  const [featuredBills, billsByTag, comingSoonBills] = await Promise.all([
    getFeaturedBills(latestRegularSession.id),
    getBillsByFeaturedTags(latestRegularSession.id),
    getComingSoonBills(latestRegularSession.id),
  ]);

  return {
    latestRegularSession,
    billsByTag,
    featuredBills,
    comingSoonBills,
  };
}
