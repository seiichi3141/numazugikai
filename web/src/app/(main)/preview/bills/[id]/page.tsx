import { AlertTriangle } from "lucide-react";
import { notFound } from "next/navigation";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import { BillDetailLayout } from "@/features/bills/server/components/bill-detail/bill-detail-layout";
import { getBillByIdAdmin } from "@/features/bills/server/loaders/get-bill-by-id-admin";
import { validatePreviewToken } from "@/features/bills/server/loaders/validate-preview-token";
import { env } from "@/lib/env";

interface PreviewBillPageProps {
  params: {
    id: string;
  };
  searchParams: {
    token?: string;
  };
}

function PreviewBanner() {
  return (
    <div className="sticky top-0 z-50 bg-mirai-warning-surface border-b border-mirai-warning-border">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-mirai-warning-text">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">
              プレビューモード - この議案は一般公開されていません
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <a
              href={`${env.adminUrl}/bills`}
              className="text-mirai-warning-text hover:text-mirai-warning-text underline"
            >
              管理画面に戻る
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function PreviewBillPage({
  params,
  searchParams,
}: PreviewBillPageProps) {
  // トークン検証
  const isValidToken = await validatePreviewToken(
    params.id,
    searchParams.token
  );
  if (!isValidToken) {
    notFound();
  }

  // 管理者用API（非公開議案も取得可能）を使用
  const bill = await getBillByIdAdmin(params.id);
  const difficulty = await getDifficultyLevel();

  if (!bill) {
    notFound();
  }

  return (
    <>
      <PreviewBanner />
      <BillDetailLayout bill={bill} currentDifficulty={difficulty} />
    </>
  );
}
