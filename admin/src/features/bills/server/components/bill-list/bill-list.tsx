import {
  FileText,
  MessageCircleQuestion,
  MessageSquareWarning,
  Plus,
} from "lucide-react";
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

/**
 * 委員会での質疑の回数。会議記録へのリンクを兼ねる。
 *
 * ほぼ全議案が可決される市議会では、質疑の多寡が議案の注目度を示す
 * 数少ない事実になる（一般会計予算は198回、質疑なしで通る議案は0回）。
 */
function CommitteeQaBadge({
  qaCount,
  minutesUrl,
}: {
  qaCount: number | null;
  minutesUrl: string | null;
}) {
  if (qaCount === null) return null;

  const badge = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
        qaCount > 0 ? "text-amber-700 bg-amber-50" : "text-gray-400 bg-gray-50"
      }`}
    >
      <MessageCircleQuestion className="h-3.5 w-3.5" />
      {qaCount > 0 ? `委員会質疑 ${qaCount}回` : "質疑なし"}
    </span>
  );

  if (!minutesUrl) return badge;
  return (
    <a
      href={minutesUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:opacity-70"
      title="会議記録検索システムで会議記録を開く"
    >
      {badge}
    </a>
  );
}

/** 会議記録から議案説明を取り込めているかどうか（AI解説の材料の有無） */
function ExplanationBadge({ hasExplanation }: { hasExplanation: boolean }) {
  if (!hasExplanation) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-emerald-700 bg-emerald-50">
      <FileText className="h-3.5 w-3.5" />
      説明あり
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
              <TableHead>会期</TableHead>
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
                議案提出日
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
          <CommitteeQaBadge
            qaCount={bill.committee_qa_count}
            minutesUrl={bill.committee_minutes_url}
          />
          <ExplanationBadge hasExplanation={bill.explanation_source !== null} />
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
