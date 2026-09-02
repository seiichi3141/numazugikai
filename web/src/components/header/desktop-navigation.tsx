import Link from "next/link";
import { HEADER_NAVIGATION_LINKS } from "./navigation-links";

interface DesktopNavigationProps {
  pathname: string;
}

function isCurrentPage(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNavigation({ pathname }: DesktopNavigationProps) {
  return (
    <nav className="hidden xl:block" aria-label="メインメニュー">
      <ul className="flex items-center gap-1">
        {HEADER_NAVIGATION_LINKS.map((link) => {
          const current = isCurrentPage(pathname, link.href);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  current
                    ? "bg-mirai-surface-accent text-primary-accent"
                    : "text-mirai-text hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
