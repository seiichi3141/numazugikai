"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectRow } from "../../shared/types/project-budget";
import {
  ALL_PURPOSES,
  filterProjectRows,
} from "../../shared/utils/build-project-rows";
import {
  formatThousandYen,
  formatYenWithUnits,
} from "../../shared/utils/format-yen";

const PAGE_SIZE = 30;

function ProjectDetails({ row }: { row: ProjectRow }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-mirai-text">
        関連する実績を見る（補助金など{row.recipients.length}件・契約
        {row.contracts.length}件）
      </summary>
      <ul className="mt-2 space-y-2">
        {row.recipients.map((recipient) => (
          <li
            key={`${recipient.kind}-${recipient.no}`}
            className="flex justify-between gap-4"
          >
            <span className="min-w-0 text-mirai-text-secondary">
              {recipient.recipient ?? "対象先の記載なし"}（{recipient.name}
              ・推定）
            </span>
            <span className="shrink-0 tabular-nums">
              {formatThousandYen(recipient.amountThousandYen)}
            </span>
          </li>
        ))}
        {row.contracts.map((contract) => (
          <li
            key={`${contract.department}-${contract.contractedOn}-${contract.name}`}
            className="flex justify-between gap-4"
          >
            <span className="min-w-0 text-mirai-text-secondary">
              {contract.party ?? "相手方は資料をご確認ください"}（
              {contract.name}・推定）
            </span>
            <span className="shrink-0 tabular-nums">
              {contract.amountYen === null
                ? "単価契約"
                : formatYenWithUnits(String(contract.amountYen))}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ProjectBudgetExplorer({
  rows,
  purposes,
}: {
  rows: ProjectRow[];
  purposes: string[];
}) {
  const [purpose, setPurpose] = useState(ALL_PURPOSES);
  const [query, setQuery] = useState("");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(
    () => filterProjectRows(rows, { purpose, query, linkedOnly }),
    [rows, purpose, query, linkedOnly]
  );
  const resetPage = () => setVisibleCount(PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[ALL_PURPOSES, ...purposes].map((value) => (
          <Button
            key={value}
            variant={purpose === value ? "default" : "outline"}
            size="sm"
            aria-pressed={purpose === value}
            onClick={() => {
              setPurpose(value);
              resetPage();
            }}
          >
            {value === ALL_PURPOSES ? "すべて" : value}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            resetPage();
          }}
          placeholder="事業名・内容・相手先で探す"
          aria-label="事業名・内容・相手先で探す"
          className="max-w-md bg-card"
        />
        <Button
          variant={linkedOnly ? "default" : "outline"}
          size="sm"
          aria-pressed={linkedOnly}
          onClick={() => {
            setLinkedOnly((value) => !value);
            resetPage();
          }}
        >
          実績がある事業だけ
        </Button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length}件が該当します（予算額の大きい順）
      </p>
      <ul className="divide-y rounded-xl border bg-card">
        {filtered.slice(0, visibleCount).map((row) => (
          <li key={row.id} className="space-y-2 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-mirai-text">{row.name}</p>
                {row.note ? (
                  <p className="text-sm text-mirai-text-secondary">
                    {row.note}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {row.purpose}
                  {" ・ "}
                  {row.moku}
                </p>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <p className="font-bold text-mirai-text">
                  予算 {formatThousandYen(row.amountThousandYen)}
                </p>
                {row.settledThousandYen === null ? null : (
                  <p className="text-sm text-mirai-text-secondary">
                    決算 {formatThousandYen(row.settledThousandYen)}
                  </p>
                )}
              </div>
            </div>
            {row.recipients.length + row.contracts.length > 0 ? (
              <ProjectDetails row={row} />
            ) : null}
          </li>
        ))}
      </ul>
      {visibleCount < filtered.length ? (
        <Button
          variant="outline"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          さらに表示
        </Button>
      ) : null}
    </div>
  );
}
