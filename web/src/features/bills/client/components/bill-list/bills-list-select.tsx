"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * 一覧の絞り込み・並び替えに使う select。
 *
 * 他の絞り込みはリンクで完結するが、select は変更を拾って遷移させる必要が
 * あるためここだけクライアントにする。状態は URL にあるので、戻る操作でも
 * 選択が復元される。
 */
export function BillsListSelect({
  label,
  value,
  options,
  toHref,
  className,
}: {
  /** 読み上げ用のラベル。画面には出さない。 */
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  /** 選んだ値から遷移先を作る。遷移しない値なら null。 */
  toHref: (next: string) => Route | null;
  className?: string;
}) {
  const router = useRouter();

  return (
    <label className={cn("flex items-center gap-2", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          const href = toHref(event.target.value);
          if (href) router.push(href);
        }}
        className="h-9 max-w-full rounded-lg border border-mirai-border bg-card px-3 text-[13px] font-medium text-mirai-text"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
