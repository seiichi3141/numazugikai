import { paginationItems } from "@mirai-gikai/shared/pagination/items";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/**
 * 議案一覧のページ送り。
 *
 * リンクだけで動かす。Server Component のまま保てるうえ、ページを開いたまま
 * 共有したときに同じページが出る。
 */
export function BillsPagination({
  current,
  total,
  href,
}: {
  current: number;
  total: number;
  /** ページ番号からリンク先を作る。 */
  href: (page: number) => Route;
}) {
  // 1ページしかないなら出さない。押せない矢印だけが残る。
  if (total <= 1) return null;

  return (
    <nav aria-label="ページ送り" className="mt-8 flex justify-center">
      <ul className="flex items-center gap-1.5">
        <li>
          <Arrow
            direction="prev"
            href={current > 1 ? href(current - 1) : undefined}
          />
        </li>
        {paginationItems(current, total).map((item) =>
          item.type === "gap" ? (
            <li
              key={`gap-${item.side}`}
              aria-hidden
              className="px-1 text-sm text-mirai-text-muted"
            >
              …
            </li>
          ) : (
            <li key={item.page}>
              <PageLink
                href={href(item.page)}
                page={item.page}
                active={item.page === current}
              />
            </li>
          )
        )}
        <li>
          <Arrow
            direction="next"
            href={current < total ? href(current + 1) : undefined}
          />
        </li>
      </ul>
    </nav>
  );
}

function PageLink({
  href,
  page,
  active,
}: {
  href: Route;
  page: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={`${page}ページ目`}
      aria-current={active ? "page" : undefined}
      className={`font-lexend flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-bold ${
        active
          ? "border-transparent bg-mirai-gradient text-mirai-text"
          : "border-mirai-border bg-white text-mirai-text hover:bg-muted/50"
      }`}
    >
      {page}
    </Link>
  );
}

/**
 * 前後の矢印。端では押せなくする。
 *
 * 消さずに残すのは、押した瞬間に並びが詰まって別のボタンが指の下に来るのを
 * 避けるため。リンクを外した span にして支援技術からも辿らせない。
 */
function Arrow({
  direction,
  href,
}: {
  direction: "prev" | "next";
  href?: Route;
}) {
  const label = direction === "prev" ? "前のページ" : "次のページ";
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const shape =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-mirai-border";

  if (!href) {
    return (
      <span
        aria-hidden
        className={`${shape} bg-white text-mirai-text-placeholder`}
      >
        <Icon className="h-4 w-4" />
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={`${shape} bg-white text-mirai-text hover:bg-muted/50`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Link>
  );
}
