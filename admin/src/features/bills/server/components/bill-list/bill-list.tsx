import { MessageSquareWarning, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { routes } from "@/lib/routes";
import { BillActionsMenu } from "../../../client/components/bill-actions-menu/bill-actions-menu";
import { PreviewButton } from "../../../client/components/bill-list/preview-button";
import { PublishStatusBadge } from "../../../client/components/bill-list/publish-status-badge";
import { ViewButton } from "../../../client/components/bill-list/view-button";
import { BILL_STATUS_CONFIG } from "../../../shared/constants/bill-config";
import type {
  BillSortConfig,
  BillStatus,
  BillWithCouncilSession,
} from "../../../shared/types";
import { countDebateStances, getBillStatusLabel } from "../../../shared/types";
import { getBills } from "../../loaders/get-bills";

/**
 * 討論があった議案であることを示すバッジ。
 *
 * 市長提出議案はほとんどが可決されるため、議決結果だけでは
 * 議論のあった議案が埋もれてしまう。反対討論の有無を前に出す。
 */
function DebateBadge({
  debates,
}: {
  debates: BillWithCouncilSession["bill_debates"];
}) {
  const counts = countDebateStances(debates ?? []);
  if (counts.total === 0) return null;

  const label =
    counts.against > 0
      ? `反対討論 ${counts.against}件`
      : `賛成討論 ${counts.for}件`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
        counts.against > 0
          ? "text-red-700 bg-red-50"
          : "text-blue-700 bg-blue-50"
      }`}
    >
      <MessageSquareWarning className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: BillStatus }) {
  const config = BILL_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className="inline-flex items-center gap-1.5 py-1 rounded-full text-sm font-bold">
      <Icon className="h-4 w-4" />
      <span>{getBillStatusLabel(status)}</span>
    </div>
  );
}

export async function BillList({ sortConfig }: { sortConfig: BillSortConfig }) {
  const bills = await getBills(sortConfig);

  return (
    <div>
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="text-sm text-gray-600">{bills.length}件の議案</div>
        <Link href={routes.billNew()}>
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            新規作成
          </Button>
        </Link>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>議案名</TableHead>
              <TableHead>国会会期</TableHead>
              <SortableTableHead
                field="publish_status_order"
                currentField={sortConfig.field}
                currentOrder={sortConfig.order}
              >
                公開ステータス
              </SortableTableHead>
              <SortableTableHead
                field="status_order"
                currentField={sortConfig.field}
                currentOrder={sortConfig.order}
              >
                審議ステータス
              </SortableTableHead>
              <SortableTableHead
                field="submitted_date"
                currentField={sortConfig.field}
                currentOrder={sortConfig.order}
              >
                法案提出日
              </SortableTableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((bill) => (
              <BillRow key={bill.id} bill={bill} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function BillRow({ bill }: { bill: BillWithCouncilSession }) {
  return (
    <TableRow>
      <TableCell className="max-w-[400px]">
        <Link
          href={routes.billEdit(bill.id) as Route}
          className="block truncate font-medium hover:underline"
        >
          {bill.name}
        </Link>
      </TableCell>
      <TableCell className="text-gray-600">
        {bill.council_sessions?.name ?? "-"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <PublishStatusBadge
            billId={bill.id}
            publishStatus={bill.publish_status}
          />
          {(bill.publish_status === "draft" ||
            bill.publish_status === "coming_soon") && (
            <PreviewButton billId={bill.id} />
          )}
          {bill.publish_status === "published" && (
            <ViewButton billId={bill.id} />
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={bill.status} />
          <DebateBadge debates={bill.bill_debates} />
        </div>
      </TableCell>
      <TableCell className="text-gray-600">
        {bill.submitted_date
          ? new Date(bill.submitted_date).toLocaleDateString("ja-JP", {
              timeZone: "Asia/Tokyo",
            })
          : "-"}
      </TableCell>
      <TableCell>
        <BillActionsMenu billId={bill.id} billName={bill.name} />
      </TableCell>
    </TableRow>
  );
}
