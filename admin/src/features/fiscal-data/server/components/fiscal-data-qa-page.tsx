import "server-only";

import type { Route } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import type {
  FiscalImportBatchPage,
  FiscalImportStatus,
  FiscalSourceKind,
  SourceArtifactRetentionState,
} from "../../shared/types";
import { formatFiscalDateTime } from "../../shared/utils/format-fiscal-date-time";
import { loadFiscalImportBatches } from "../loaders/load-fiscal-import-batches";

const PAGE_SIZE = 25;

const sourceKindLabels = {
  budget_overview: "予算概要",
  execution_report: "予算執行状況",
  settlement_report: "決算概要",
  major_measures: "主要施策報告",
  fiscal_comparison: "財政比較資料",
  public_accounting: "地方公会計",
} satisfies Record<FiscalSourceKind, string>;

const statusLabels = {
  running: "解析中",
  awaiting_review: "確認待ち",
  approved: "承認済み",
  applied: "反映済み",
  failed: "解析失敗",
} satisfies Record<FiscalImportStatus, string>;

const retentionStateLabels = {
  pending: "保存待ち",
  retained: "保持中",
  expired: "保持期限切れ",
  not_permitted: "保持不可",
} satisfies Record<SourceArtifactRetentionState, string>;

export async function FiscalDataQaPage({ page }: { page: number }) {
  const result = await loadFiscalImportBatches({ page, pageSize: PAGE_SIZE });
  return <FiscalImportBatchList result={result} />;
}

export function FiscalImportBatchList({
  result,
}: {
  result: FiscalImportBatchPage;
}) {
  const pageCount = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));
  const pendingCount = result.items.reduce(
    (sum, item) => sum + item.pendingCount,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">財政データQA</h1>
        <p className="mt-2 text-muted-foreground">
          予算・決算の公式資料を版保存し、解析結果と検算警告を公開前に確認します。
        </p>
      </div>

      <p aria-live="polite" className="rounded-xl border bg-card p-4 shadow-sm">
        表示中の未確認レコード: {pendingCount}件（全{result.totalCount}
        バッチ中、{result.page} / {pageCount}ページ）
      </p>

      {result.totalCount === 0 ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          取込み待ちです。財政資料を解析すると、取得版と確認対象がここに表示されます。
        </div>
      ) : (
        <div className="space-y-4">
          {result.items.map((batch) => (
            <article
              key={batch.id}
              className="rounded-xl border bg-card p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {batch.fiscalYear ? `${batch.fiscalYear}年度` : "年度不明"}{" "}
                    ・ {sourceKindLabels[batch.sourceKind] ?? batch.sourceKind}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {batch.sourceUrl ? (
                      <a
                        href={batch.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {batch.sourceTitle}
                      </a>
                    ) : (
                      batch.sourceTitle
                    )}
                  </h2>
                </div>
                <Badge
                  variant={
                    batch.status === "failed" ? "destructive" : "outline"
                  }
                >
                  {statusLabels[batch.status] ?? batch.status}
                </Badge>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="font-medium">取得日時</dt>
                  <dd>{formatFiscalDateTime(batch.fetchedAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium">解析完了日時</dt>
                  <dd>{formatFiscalDateTime(batch.finishedAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium">原本保持</dt>
                  <dd>{retentionStateLabels[batch.retentionState]}</dd>
                </div>
                <div>
                  <dt className="font-medium">parser</dt>
                  <dd>
                    {batch.parserName} {batch.parserVersion}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">source profile</dt>
                  <dd>
                    {batch.profileKey} {batch.profileVersion}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">
                  発見 {batch.discoveredCount}件
                </Badge>
                <Badge variant="secondary">候補 {batch.stagedCount}件</Badge>
                <Badge variant="secondary">未確認 {batch.pendingCount}件</Badge>
                <Badge
                  variant={
                    batch.hardErrorCount > 0 ? "destructive" : "secondary"
                  }
                >
                  hard error {batch.hardErrorCount}件
                </Badge>
                <Badge variant="outline">warning {batch.warningCount}件</Badge>
              </div>
              {batch.validationMessages.length > 0 ? (
                <div
                  role={batch.hardErrorCount > 0 ? "alert" : undefined}
                  className="mt-4 rounded-md border p-3 text-sm"
                >
                  <h3 className="font-semibold">検算結果</h3>
                  <ul className="mt-1 list-disc pl-5">
                    {batch.validationMessages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label="財政取込バッチのページ"
          className="flex items-center gap-3"
        >
          {result.page > 1 ? (
            <Button asChild variant="outline">
              <Link href={routes.fiscalDataQa(result.page - 1) as Route}>
                前へ
              </Link>
            </Button>
          ) : null}
          <span className="text-sm text-muted-foreground">
            {result.page} / {pageCount}
          </span>
          {result.page < pageCount ? (
            <Button asChild variant="outline">
              <Link href={routes.fiscalDataQa(result.page + 1) as Route}>
                次へ
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
