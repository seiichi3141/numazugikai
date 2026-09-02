import type { Metadata } from "next";
import { getBillById } from "@/features/bills/server/loaders/get-bill-by-id";
import { getBillOgVersion } from "@/features/bills/shared/utils/get-bill-og-version";
import { BillOpinionsPage } from "@/features/user-topic-analysis/server/components/bill-opinions-page";
import { env } from "@/lib/env";
import { buildShareMetadata } from "@/lib/metadata/share-metadata";
import { ogImageUrls } from "@/lib/og/og-image-urls";
import { routes } from "@/lib/routes";

interface OpinionsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: OpinionsPageProps): Promise<Metadata> {
  const { id } = await params;
  const bill = await getBillById(id);
  const title = bill?.bill_content?.title || bill?.name || "議案";

  return buildShareMetadata({
    title: `AIインタビューの回答一覧 - ${title}`,
    description: `${title}に寄せられたAIインタビューの回答一覧`,
    canonical: routes.billOpinions(id),
    image: ogImageUrls.bill(
      id,
      env.webUrl,
      bill ? getBillOgVersion(bill) : null
    ),
    imageAlt: `${title} のOGPイメージ`,
  });
}

export default async function OpinionsPage({ params }: OpinionsPageProps) {
  const { id } = await params;
  return <BillOpinionsPage billId={id} />;
}
