import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/**
 * 絞り込みのチップ。
 *
 * ステータスとカテゴリで同じ描画にする。片方だけラベルに数字を混ぜると、
 * 数字のフォントや色が並びの中で食い違う。
 */
export function FilterChip({
  href,
  active,
  label,
  count,
  icon: Icon,
}: {
  href: Route;
  active: boolean;
  label: string;
  count: number;
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      // 数字を分けて表示しているので、読み上げ名は連結すると「可決78」に
      // なって件数だと伝わらない。名前ごと与えて単位を補う。
      aria-label={`${label} ${count}件`}
      // 絞り込みの選択状態。aria-current は「現在のページ・手順」を表す
      // ものなので、押している／いないを表す aria-pressed を使う。
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-bold whitespace-nowrap ${
        active
          ? "border-transparent bg-mirai-gradient text-mirai-text"
          : "border-mirai-border bg-white text-mirai-text"
      }`}
    >
      {Icon && <Icon className="h-[15px] w-[15px] shrink-0" aria-hidden />}
      {label}
      {/*
        選択中だけ濃くする。全部同じ濃さだとラベルと数字の区別が付かず、
        どれが選ばれているのかも読み取りにくい。色はトップのタグチップ
        （TagChipLink）に揃えている。
      */}
      <span
        className={`font-lexend text-xs font-bold ${
          active ? "text-mirai-text" : "text-mirai-text-muted"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
