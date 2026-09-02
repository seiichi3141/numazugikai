import { ExternalLink } from "lucide-react";
import type { BillDebate } from "../../../shared/types";

interface BillDebatesSectionProps {
  debates: BillDebate[];
}

const STANCE_LABELS: Record<BillDebate["stance"], string> = {
  for: "賛成討論",
  against: "反対討論",
};

export function BillDebatesSection({ debates }: BillDebatesSectionProps) {
  if (debates.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="bill-debates-heading"
      className="rounded-2xl border border-mirai-border bg-white p-5"
    >
      <div className="space-y-2">
        <h2
          id="bill-debates-heading"
          className="text-lg font-bold text-mirai-text"
        >
          本会議での討論
        </h2>
        <p className="text-sm leading-relaxed text-mirai-text-secondary">
          この議案について行われた賛成・反対討論です。発言内容は沼津市議会の公式な会議録・議会中継で確認できます。
        </p>
      </div>

      <ul className="mt-4 divide-y divide-mirai-border-light">
        {debates.map((debate) => (
          <li
            key={debate.id}
            className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-mirai-text">
                {debate.speaker_name}
              </span>
              {debate.seat_number != null && (
                <span className="text-xs text-mirai-text-muted">
                  議席番号 {debate.seat_number}
                </span>
              )}
              <span className="rounded-full bg-mirai-surface-muted px-2.5 py-1 text-xs font-bold text-mirai-text-secondary">
                {STANCE_LABELS[debate.stance]}
              </span>
            </div>
            <a
              href={debate.source_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`公式記録で${debate.speaker_name}議員の討論を確認`}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-mirai-text underline underline-offset-4 hover:opacity-70"
            >
              公式記録で討論を確認
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
