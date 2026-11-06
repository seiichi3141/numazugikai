"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  RecipientKind,
  SpendingRecipient,
} from "../../shared/types/spending-flow";
import {
  filterSpendingRecipients,
  type RecipientKindFilter,
} from "../../shared/utils/filter-spending-recipients";
import { formatThousandYen } from "../../shared/utils/format-yen";

const PAGE_SIZE = 30;

const KIND_LABELS: Record<RecipientKind, string> = {
  subsidy: "補助金",
  burden: "負担金",
  grant: "交付金",
};

const KIND_FILTERS: { value: RecipientKindFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "subsidy", label: KIND_LABELS.subsidy },
  { value: "burden", label: KIND_LABELS.burden },
  { value: "grant", label: KIND_LABELS.grant },
];

export function SpendingRecipientExplorer({
  recipients,
}: {
  recipients: SpendingRecipient[];
}) {
  const [kind, setKind] = useState<RecipientKindFilter>("all");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(
    () => filterSpendingRecipients(recipients, kind, query),
    [recipients, kind, query]
  );
  const visibleRows = filtered.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {KIND_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            variant={kind === filter.value ? "default" : "outline"}
            size="sm"
            aria-pressed={kind === filter.value}
            onClick={() => {
              setKind(filter.value);
              setVisibleCount(PAGE_SIZE);
            }}
          >
            {filter.label}
          </Button>
        ))}
      </div>
      <Input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setVisibleCount(PAGE_SIZE);
        }}
        placeholder="団体名・事業名・担当課で探す"
        aria-label="団体名・事業名・担当課で探す"
        className="max-w-md bg-card"
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length}件が該当します（金額の大きい順）
      </p>
      <ul className="divide-y rounded-xl border bg-card">
        {visibleRows.map((row) => (
          <li
            key={`${row.kind}-${row.no}`}
            className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-mirai-text">
                {row.recipient ?? "（対象先の記載なし）"}
              </p>
              <p className="text-sm text-mirai-text-secondary">{row.name}</p>
              <p className="text-xs text-muted-foreground">
                {KIND_LABELS[row.kind]}
                {" ・ "}
                {[row.department, row.division].filter(Boolean).join(" ")}
              </p>
            </div>
            <p className="shrink-0 font-bold tabular-nums text-mirai-text">
              {formatThousandYen(row.amountThousandYen)}
            </p>
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
