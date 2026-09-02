import type { Metadata } from "next";
import { getBillById } from "@/features/bills/server/loaders/get-bill-by-id";
import { getBillOgVersion } from "@/features/bills/shared/utils/get-bill-og-version";
import { TopicListPage } from "@/features/user-topic-analysis/server/components/topic-list-page";
import { env } from "@/lib/env";
import { buildShareMetadata } from "@/lib/metadata/share-metadata";
import { ogImageUrls } from "@/lib/og/og-image-urls";
import { routes } from "@/lib/routes";

interface TopicsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: TopicsPageProps): Promise<Metadata> {
  const { id } = await params;
  const bill = await getBillById(id);
  const billName = bill?.bill_content?.title || bill?.name || "議案";
  const title = `議案のトピック一覧 - ${billName}`;
  const description = `${billName}に寄せられた意見をAIが整理したトピック一覧`;
  return buildShareMetadata({
    title,
    description,
    canonical: routes.billTopics(id),
    image: ogImageUrls.bill(
      id,
      env.webUrl,
      bill ? getBillOgVersion(bill) : null
    ),
    imageAlt: `${billName} のOGPイメージ`,
  });
}

export default async function TopicsPage({ params }: TopicsPageProps) {
  const { id } = await params;
  return <TopicListPage billId={id} />;
}
