import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import { BillDetailLayout } from "@/features/bills/server/components/bill-detail/bill-detail-layout";
import { getBillById } from "@/features/bills/server/loaders/get-bill-by-id";
import { getBillOgVersion } from "@/features/bills/shared/utils/get-bill-og-version";
import { env } from "@/lib/env";
import { buildShareMetadata } from "@/lib/metadata/share-metadata";
import { ogImageUrls } from "@/lib/og/og-image-urls";
import { routes } from "@/lib/routes";

interface BillDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: BillDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const bill = await getBillById(id);

  if (!bill) {
    return {
      title: "議案が見つかりません",
    };
  }

  return buildShareMetadata({
    title: bill.name,
    // bill_contentのsummaryがあればそれを使用、なければデフォルト値を使用
    description: bill.bill_content?.summary || "議案の詳細情報",
    canonical: routes.billDetail(bill.id),
    // 議案ごとに動的に描く。更新されたら URL が変わり SNS 側のキャッシュも切れる
    image: ogImageUrls.bill(bill.id, env.webUrl, getBillOgVersion(bill)),
    imageAlt: `${bill.name} のOGPイメージ`,
    type: "article",
    publishedTime: bill.submitted_date ?? undefined,
    modifiedTime: bill.updated_at,
  });
}

export default async function BillDetailPage({ params }: BillDetailPageProps) {
  const { id } = await params;
  const [billWithContent, currentDifficulty] = await Promise.all([
    getBillById(id),
    getDifficultyLevel(),
  ]);

  if (!billWithContent) {
    notFound();
  }

  return (
    <BillDetailLayout
      bill={billWithContent}
      currentDifficulty={currentDifficulty}
    />
  );
}
