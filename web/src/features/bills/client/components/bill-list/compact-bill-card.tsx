import { Card } from "@/components/ui/card";
import { formatDateWithDots } from "@/lib/utils/date";
import type { BillWithContent } from "../../../shared/types";
import { ReviewCompleteBadge } from "../bill-detail/review-status-banner";
import { BillThumbnail } from "../bill-thumbnail";
import { BillNumberLabel } from "./bill-number-label";
import { BillStatusBadge } from "./bill-status-badge";

interface CompactBillCardProps {
  bill: BillWithContent;
  className?: string;
}

/**
 * コンパクトな水平レイアウトの議案カード
 * 過去の定例会セクションや過去の定例会の議案一覧ページで使用
 */
export function CompactBillCard({ bill, className }: CompactBillCardProps) {
  const displayTitle = bill.bill_content?.title || bill.name;

  return (
    <Card
      className={`border border-black shadow-none hover:bg-muted/50 transition-colors overflow-hidden ${className ?? ""}`}
    >
      <div className="flex">
        {/* コンテンツエリア */}
        <div className="flex-1 p-4 flex flex-col gap-2">
          <h3 className="font-bold text-[15px] leading-[1.6] line-clamp-2">
            {displayTitle}
            {bill.is_review_completed && (
              <>
                {" "}
                <ReviewCompleteBadge size={14} top="1px" />
              </>
            )}
          </h3>
          <div className="flex items-center gap-3">
            <BillStatusBadge status={bill.status} className="w-fit" />
            <BillNumberLabel billNumber={bill.bill_number} />
            {bill.submitted_date && (
              <span className="text-xs text-muted-foreground">
                {formatDateWithDots(bill.submitted_date)} 提出
              </span>
            )}
          </div>
        </div>

        {/* サムネイル画像 */}
        <BillThumbnail
          bill={bill}
          className="w-24 h-16 flex-shrink-0 self-center mr-4 rounded-lg"
          sizes="96px"
        />
      </div>
    </Card>
  );
}
