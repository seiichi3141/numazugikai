import { ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * パンくず。
 *
 * 順序のあるリストで組む。階層の順番と項目数に意味があり、読み上げでも
 * 「リスト 2項目」と伝わる。同じページに補助ナビ・カテゴリ・ページ送りの
 * nav が並ぶので、ランドマークには名前を付けて区別できるようにする。
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="パンくずリスト">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-mirai-text">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2">
            {/* 区切りは見た目だけの記号。読み上げると意味を成さない */}
            {index > 0 && <ChevronRight className="w-4 h-4" aria-hidden />}
            {item.href ? (
              <Link href={item.href as Route} className="hover:underline">
                {item.label}
              </Link>
            ) : (
              // リンクの無い項目は現在地。どこに居るのかを伝える
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
