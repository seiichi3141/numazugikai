import "server-only";

import {
  AlignLeft,
  Check,
  Clock,
  ExternalLink,
  type LucideIcon,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import { HomeChatClient } from "@/features/chat/client/components/home-chat-client";
import { getCouncilSessionOptions } from "@/features/council-sessions/server/loaders/get-council-session-options";
import { routes } from "@/lib/routes";
import { BillSearchCard } from "../../client/components/bill-list/bill-search-card";
import { BillsPagination } from "../../client/components/bill-list/bills-pagination";
import { BillsSessionSelect } from "../../client/components/bill-list/bills-session-select";
import { BillsSortSelect } from "../../client/components/bill-list/bills-sort-select";
import { FilterChip } from "../../client/components/bill-list/filter-chip";
import { InterviewOnlyToggle } from "../../client/components/bill-list/interview-only-toggle";
import type { BillStatusGroup } from "../../shared/utils/bill-status-group";
import {
  BILL_STATUS_GROUP_LABELS,
  BILL_STATUS_GROUPS,
} from "../../shared/utils/bill-status-group";
import { FACET_ALL } from "../../shared/utils/bills-list-facets";
import { chatBillName } from "../../shared/utils/chat-bill-name";
import {
  type BillsListParams,
  type BillsListSearchParams,
  billsListHref,
  parseBillsListParams,
} from "../../shared/utils/parse-bills-list-params";
import { toSessionFilterOptions } from "../../shared/utils/session-filter-options";
import { splitIntoRows } from "../../shared/utils/split-into-rows";
import { toTagChipItemsFromCounts } from "../../shared/utils/tag-chip-items";
import { tagChipRowCount } from "../../shared/utils/tag-chip-row-count";
import { getBillsListPage } from "../loaders/get-bills-list-page";
import { getFeaturedTags } from "../loaders/get-featured-tags";

/** 沼津市議会「本会議の報告」。掲載外の議案を含む審議結果が期ごとに並ぶ。 */
const NUMAZU_GIKAI_REPORT_INDEX_URL =
  "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/annai/houkoku/index.htm";

/**
 * 議案一覧（/bills）。見出しは「議案を検索する」。
 *
 * 絞り込みの状態はすべて URL に載せる。並び替え以外はリンクで完結するので、
 * ページ全体を Server Component のまま保てる。
 */
export async function BillsListPage({
  searchParams,
}: {
  searchParams: BillsListSearchParams;
}) {
  const requested = parseBillsListParams(searchParams);
  // 絞り込み・並び替え・ページングはDBが行う。全件をアプリに持ってくると、
  // 議案が1000件を超えたあたりで絞り込みのクリックごとに待ち時間が出る。
  // 難易度は cookie なのでI/Oを伴わない。ここで一度だけ読み、一覧にも渡す。
  const currentDifficulty = await getDifficultyLevel();
  // 会期の選択肢は一覧の絞り込みにも使うので先に取る。
  const sessions = await getCouncilSessionOptions();
  const [
    { bills, total, page, totalPages, facets, session: sessionSlug },
    featuredTags,
  ] = await Promise.all([
    getBillsListPage(requested, currentDifficulty, sessions),
    getFeaturedTags(),
  ]);
  // 存在しない会期の slug はここで落とす。以降のリンクに引き継がない。
  const params = { ...requested, session: sessionSlug };
  const sessionOptions = toSessionFilterOptions(
    sessions,
    facets.session,
    params.session
  );

  const statusCounts = facets.status;
  const tags = toTagChipItemsFromCounts(featuredTags, facets.tag, params.tagId);
  const tagChips = [
    {
      id: "all",
      label: "すべて",
      tagId: null,
      count: facets.tag.get(FACET_ALL) ?? 0,
    },
    ...tags.map((tag) => ({
      id: tag.id,
      label: tag.label,
      tagId: tag.id,
      count: tag.count,
    })),
  ];
  // typedRoutes はクエリ付きのテンプレート文字列を推論できないため、
  // リンク生成をここに集約してキャストも1箇所に閉じる。
  const href = (patch: Partial<BillsListParams>) =>
    billsListHref(params, patch);

  return (
    <>
      <Container className="pt-24 pb-8 md:pt-8">
        <div className="mb-3">
          <Breadcrumb
            items={[
              { label: "トップ", href: routes.home() },
              { label: "議案を検索する" },
            ]}
          />
        </div>

        <h1 className="mb-4 text-3xl font-bold">議案を検索する</h1>

        <form action={routes.billsList()} className="mb-5">
          <div className="flex h-12 items-center gap-2.5 rounded-full border border-mirai-border bg-white pr-4 pl-5">
            <Search
              className="h-[18px] w-[18px] shrink-0 text-mirai-text-muted"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              aria-label="議案を検索"
              defaultValue={params.query}
              placeholder="議案名やキーワードで探す"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          {/*
          検索しても他の絞り込みを落とさない。既定値を出さない規則は
          buildBillsListQuery が持っているので、そこから導出する。
          q はテキスト入力が持つので取り除く。
        */}
          {[
            ...new URLSearchParams(
              billsListHref(params, { query: "" }).split("?")[1] ?? ""
            ),
          ].map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>

        <FilterGroup label="ステータス">
          {BILL_STATUS_GROUPS.map((group) => (
            <FilterChip
              key={group}
              href={href({ status: group })}
              active={params.status === group}
              icon={STATUS_GROUP_ICONS[group]}
              label={BILL_STATUS_GROUP_LABELS[group]}
              count={statusCounts[group]}
            />
          ))}
        </FilterGroup>

        <section className="mb-4">
          <h2 className="mb-2 text-[13px] font-bold text-mirai-text-secondary">
            カテゴリ
          </h2>
          {/*
          タグは本番で18件あり、折り返すと縦に伸びて一覧が押し下がる。
          多いときは2行に詰めて横スクロールさせる。grid で流すと列幅が最長の
          チップに揃って短いチップの右に空白が残るので、行ごとに独立した
          flex にする。

          少ないときは1行にする。絞り込みでチップが数個に減ったときに2行へ
          割ると、横に余白があるのに縦に並んでしまう。
        */}
          <div className="scrollbar-hide overflow-x-auto">
            <div className="flex w-max flex-col gap-1.5">
              {splitIntoRows(tagChips, tagChipRowCount(tagChips.length)).map(
                (row, rowIndex) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: 行は固定順で再並びしない
                    key={rowIndex}
                    className="flex items-center gap-1.5"
                  >
                    {row.map((chip) => (
                      <FilterChip
                        key={chip.id}
                        href={href({ tagId: chip.tagId })}
                        active={params.tagId === chip.tagId}
                        label={chip.label}
                        count={chip.count}
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        <FilterGroup label="会期">
          <BillsSessionSelect params={params} options={sessionOptions} />
        </FilterGroup>

        <InterviewOnlyToggle
          href={href({ interviewOnly: !params.interviewOnly })}
          checked={params.interviewOnly}
        />

        <div className="mb-3 flex items-center gap-3">
          <p className="text-[13px] font-bold text-mirai-text-secondary">
            {total}件の議案
          </p>
          <BillsSortSelect params={params} />
        </div>

        {bills.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-mirai-border bg-white px-6 py-16 text-center">
            <Search
              className="h-10 w-10 text-mirai-text-placeholder"
              aria-hidden
            />
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-bold">
                該当する議案が見つかりませんでした
              </p>
              <p className="text-[13px] text-mirai-text-muted">
                キーワードを変えるか、絞り込み条件を解除してお試しください
              </p>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {bills.map((bill) => (
                <li key={bill.id}>
                  <BillSearchCard bill={bill} />
                </li>
              ))}
            </ul>
            <BillsPagination
              current={page}
              total={totalPages}
              href={(page) => href({ page })}
            />
          </>
        )}

        {/* 掲載外の議案は沼津市議会の公式ページに送る */}
        <div className="mt-8 text-sm text-mirai-text-secondary">
          <Link
            href={NUMAZU_GIKAI_REPORT_INDEX_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:opacity-80"
          >
            沼津市議会に提出されたすべての議案は{" "}
            <span className="underline">沼津市議会の本会議報告へ</span>
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </Container>

      {/*
        チャットはトップと同じものを出す。文脈は表示中のページに合わせる。
        絞り込み結果を全件渡していた頃と違い、渡せるのは今開いているページの
        議案だけになる。全件をLLMの文脈に載せると議案数ぶんに膨らむので、
        ページ単位で足りるとみなす。
      */}
      <HomeChatClient
        currentDifficulty={currentDifficulty}
        bills={bills.map((bill) => ({
          name: chatBillName(bill),
          summary: bill.bill_content?.summary ?? undefined,
          tags: bill.tags?.map((tag) => tag.label) ?? [],
        }))}
      />
    </>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 text-[13px] font-bold text-mirai-text-secondary">
        {label}
      </h2>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </section>
  );
}

/** ステータスごとの目印。ラベルだけの列より状態が見分けやすくなる。 */
const STATUS_GROUP_ICONS: Record<BillStatusGroup, LucideIcon> = {
  all: AlignLeft,
  deliberating: MessageSquare,
  waiting: Clock,
  enacted: Check,
  rejected: X,
};
