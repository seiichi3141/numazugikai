import { Container } from "@/components/layouts/container";
import { About } from "@/components/top/about";
import { ComingSoonSection } from "@/components/top/coming-soon-section";
import { NumazuHero } from "@/components/top/numazu-hero";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import { BillDisclaimer } from "@/features/bills/client/components/bill-detail/bill-disclaimer";
import { BillSearchOverlay } from "@/features/bills/client/components/bill-search-overlay";
import { LatestRegularSessionHeading } from "@/features/bills/client/components/latest-regular-session-heading";
import { BillsByTagSection } from "@/features/bills/server/components/bills-by-tag-section";
import { CategoryTabs } from "@/features/bills/server/components/category-tabs";
import { FeaturedBillSection } from "@/features/bills/server/components/featured-bill-section";
import { getFeaturedTags } from "@/features/bills/server/loaders/get-featured-tags";
import { getSuggestableBills } from "@/features/bills/server/loaders/get-suggestable-bills";
import { loadHomeData } from "@/features/bills/server/loaders/load-home-data";
import type { BillWithContent } from "@/features/bills/shared/types";
import { chatBillName } from "@/features/bills/shared/utils/chat-bill-name";
import { countTagChipItems } from "@/features/bills/shared/utils/tag-chip-items";
import { HomeChatClient } from "@/features/chat/client/components/home-chat-client";
import { CurrentCouncilSession } from "@/features/council-sessions/client/components/current-council-session";
import { getCurrentCouncilSession } from "@/features/council-sessions/server/loaders/get-current-council-session";
import { getLatestClosedCouncilSession } from "@/features/council-sessions/server/loaders/get-latest-closed-council-session";
import { routes } from "@/lib/routes";
import { getJapanTime } from "@/lib/utils/date";

/** カテゴリタブの「注目」から飛ばす先。 */
const FEATURED_ANCHOR = "featured";

export default async function Home() {
  const japanTime = getJapanTime();
  // ゆくゆくタグ機能がマージされたらBFFに統合する
  const [
    { latestRegularSession, billsByTag, featuredBills, comingSoonBills },
    currentSession,
    latestClosedSession,
    currentDifficulty,
    suggestableBills,
    featuredTags,
  ] = await Promise.all([
    loadHomeData(),
    getCurrentCouncilSession(japanTime),
    getLatestClosedCouncilSession(japanTime),
    getDifficultyLevel(),
    getSuggestableBills(),
    getFeaturedTags(),
  ]);

  const isLatestRegularSessionActive =
    currentSession?.id === latestRegularSession?.id;

  // 注目に出した議案はタグ別から外す。同じカードが2回並ぶのを避ける。
  const featuredIds = new Set(
    isLatestRegularSessionActive ? featuredBills.map((bill) => bill.id) : []
  );
  const pickedBillsByTag = billsByTag
    .map((group) => ({
      ...group,
      bills: group.bills.filter((bill) => !featuredIds.has(bill.id)),
    }))
    // 注目に出た議案しか無かったタグは、見出しだけが残るので落とす。
    .filter((group) => group.bills.length > 0);

  // モーダルの件数は全会期の公開議案から数える。チップの飛び先が /bills で、
  // あちらも全会期を数えるため、押す前と後で数字が変わらない。
  // 候補用に取得済みの配列をそのまま使うので、集計のためのクエリは増えない。
  const searchTagChips = countTagChipItems(featuredTags, suggestableBills);

  const toBillChatContext = (bill: BillWithContent) => {
    return {
      name: chatBillName(bill),
      url: routes.billDetail(bill.id),
      summary: bill.bill_content?.summary,
      tags: bill.tags?.map((tag) => tag.label) || [],
      isFeatured: featuredBills.some((b) => b.id === bill.id),
    };
  };

  return (
    <>
      <NumazuHero />

      {/* 本日の市議会セクション */}
      <CurrentCouncilSession
        session={currentSession}
        closedSession={latestClosedSession}
        now={japanTime}
      />

      <Container>
        {latestRegularSession && (
          <div className="pt-6">
            <LatestRegularSessionHeading session={latestRegularSession} />
          </div>
        )}
        <div className="pt-4">
          <CategoryTabs
            billsByTag={billsByTag}
            featuredAnchor={
              isLatestRegularSessionActive ? FEATURED_ANCHOR : undefined
            }
          />
        </div>
        {/* 検索の入口。キーワードとテーマの両方をモーダルに並べる */}
        <div className="flex justify-end pt-2">
          <BillSearchOverlay tags={searchTagChips} bills={suggestableBills} />
        </div>
      </Container>

      {/* 議案一覧セクション */}
      <Container className="">
        <div className="py-10">
          <main className="flex flex-col gap-16">
            {/*
              注目の議案は会期中だけ出す。閉会中に「注目」を掲げても、審議が
              動いていない期間の情報を強調することになる。
              最新の定例会が開催中の場合だけ、その会期の注目議案を出す。
            */}
            {isLatestRegularSessionActive && (
              <section id={FEATURED_ANCHOR}>
                <FeaturedBillSection bills={featuredBills} />
              </section>
            )}

            {/* 最新の定例会にある議案をタグ別に表示する */}
            <BillsByTagSection billsByTag={pickedBillsByTag} />

            {/* Coming soonセクション */}
            <ComingSoonSection bills={comingSoonBills} />
          </main>
        </div>
      </Container>

      <Container>
        {/* みらい議会＠沼津市とは セクション */}
        <About />

        {/* 免責事項 */}
        <BillDisclaimer />
      </Container>

      {/* チャット機能 */}
      <HomeChatClient
        currentDifficulty={currentDifficulty}
        bills={billsByTag
          .flatMap((x) => x.bills)
          .concat(featuredBills)
          .map(toBillChatContext)}
      />
    </>
  );
}
