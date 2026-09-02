import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { CouncilSession } from "@/features/council-sessions/shared/types";
import { routes } from "@/lib/routes";

export function LatestRegularSessionHeading({
  session,
}: {
  session: CouncilSession;
}) {
  const title = `${session.name}の議案`;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-bold text-primary-accent">表示中の定例会</p>
      {session.slug ? (
        <Link
          href={routes.gikaiSessionBills(session.slug)}
          className="group flex w-fit items-center gap-1.5"
        >
          <h2 className="text-[22px] leading-[1.48] font-bold text-mirai-text">
            {title}
          </h2>
          <ChevronRight className="size-6 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <h2 className="text-[22px] leading-[1.48] font-bold text-mirai-text">
          {title}
        </h2>
      )}
      <p className="text-xs font-medium text-mirai-text-secondary">
        最新の定例会に提出された議案を表示しています
      </p>
    </div>
  );
}
