import "server-only";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { routes } from "@/lib/routes";
import {
  formatDateWithDots,
  getJapanTime,
  toDateOnlyString,
} from "@/lib/utils/date";
import type { CouncilSessionSummary } from "../../shared/types";
import {
  getSessionTiming,
  groupSessionsByYear,
  SESSION_TIMING_LABELS,
} from "../../shared/utils/session-timeline";
import { getCouncilSessions } from "../loaders/get-council-sessions";

/** 定例会・臨時会の一覧。年ごとにまとめ、議案のある会期は議案一覧へつなぐ。 */
export async function CouncilSessionsPage() {
  const sessions = await getCouncilSessions();
  const today = toDateOnlyString(getJapanTime());
  const years = groupSessionsByYear(sessions);

  return (
    <div className="bg-mirai-surface-muted min-h-dvh">
      <Container className="pt-24 pb-8 md:pt-8 flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1>
            <span className="font-lexend text-[32px] leading-none font-bold tracking-tight text-mirai-text">
              Archive
            </span>
          </h1>
          <p className="text-sm font-bold text-primary-accent">
            定例会・臨時会の一覧
          </p>
          <p className="text-xs font-medium text-mirai-text">
            会期を選ぶと、その会期に提出された議案の一覧に進みます。
          </p>
        </div>

        {years.map(({ year, sessions }) => (
          <section key={year} className="flex flex-col gap-3">
            <h2 className="text-[22px] font-bold text-mirai-text leading-[1.48]">
              {year}年
            </h2>
            <ul className="flex flex-col gap-3">
              {sessions.map((session) => (
                <li key={session.id}>
                  <SessionRow session={session} today={today} />
                </li>
              ))}
            </ul>
          </section>
        ))}

        <Breadcrumb
          items={[
            { label: "トップ", href: routes.home() },
            { label: "定例会の一覧" },
          ]}
        />
      </Container>
    </div>
  );
}

function SessionRow({
  session,
  today,
}: {
  session: CouncilSessionSummary;
  today: string;
}) {
  const timing = getSessionTiming(session, today);
  const period = `${formatDateWithDots(session.start_date)}〜${formatDateWithDots(session.end_date)}`;
  // 議案の無い会期はリンクにしない。空の一覧に飛ばすより、ここで分かる方がよい。
  const hasBills = session.publishedBillCount > 0;
  // slug の無い会期は議案一覧ページが無いので、件数だけ出してリンクにしない
  const billsSlug = hasBills ? session.slug : null;

  const body = (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-mirai-text bg-card px-4 py-3 group-hover:bg-muted/50 transition-colors">
      <div className="flex flex-col gap-1">
        <span className="font-bold text-[15px] leading-[1.6]">
          {session.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {period}
          {timing !== "closed" && ` ・ ${SESSION_TIMING_LABELS[timing]}`}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-sm">
        {hasBills ? (
          <>
            <span>議案 {session.publishedBillCount}件</span>
            {billsSlug !== null && (
              <ChevronRight
                className="h-5 w-5 text-mirai-text-muted"
                aria-hidden="true"
              />
            )}
          </>
        ) : (
          <span className="text-muted-foreground">議案は未掲載</span>
        )}
      </div>
    </div>
  );

  if (billsSlug === null) {
    return body;
  }
  return (
    <Link href={routes.gikaiSessionBills(billsSlug)} className="group block">
      {body}
    </Link>
  );
}
