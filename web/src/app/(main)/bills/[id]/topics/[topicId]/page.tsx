import type { Metadata } from "next";
import { getBillById } from "@/features/bills/server/loaders/get-bill-by-id";
import { getBillOgVersion } from "@/features/bills/shared/utils/get-bill-og-version";
import { TopicDetailPage } from "@/features/user-topic-analysis/server/components/topic-detail-page";
import { getPublicTopicDetail } from "@/features/user-topic-analysis/server/loaders/get-public-topic-detail";
import { parseTopicFilter } from "@/features/user-topic-analysis/shared/utils/filter-topics";
import { env } from "@/lib/env";
import { buildShareMetadata } from "@/lib/metadata/share-metadata";
import { ogImageUrls } from "@/lib/og/og-image-urls";
import { routes } from "@/lib/routes";

interface TopicDetailRouteProps {
  params: Promise<{ id: string; topicId: string }>;
  searchParams: Promise<{ filter?: string }>;
}

export async function generateMetadata({
  params,
}: TopicDetailRouteProps): Promise<Metadata> {
  const { id, topicId } = await params;
  // タイトル/説明はフィルタに依存しないため絞り込みなし（all）で取得する。
  // DB取得は getPublicTopicAnalysis の React cache() でページ本体と共有され、
  // リクエスト内で重複クエリにならない。
  const [bill, location] = await Promise.all([
    getBillById(id),
    getPublicTopicDetail(id, topicId),
  ]);
  const billName = bill?.bill_content?.title || bill?.name || "議案";
  const topic = location?.topic;

  const title = topic
    ? `${topic.title} - ${billName}`
    : `トピック詳細 - ${billName}`;
  const description =
    topic?.description || `${billName}に寄せられた意見トピックの詳細`;
  return buildShareMetadata({
    title,
    description,
    canonical: routes.billTopicDetail(id, topicId),
    image: ogImageUrls.bill(
      id,
      env.webUrl,
      bill ? getBillOgVersion(bill) : null
    ),
    imageAlt: `${title} のOGPイメージ`,
    type: "article",
  });
}

export default async function TopicDetailRoute({
  params,
  searchParams,
}: TopicDetailRouteProps) {
  const { id, topicId } = await params;
  const { filter } = await searchParams;
  return (
    <TopicDetailPage
      billId={id}
      topicId={topicId}
      filter={parseTopicFilter(filter)}
    />
  );
}
