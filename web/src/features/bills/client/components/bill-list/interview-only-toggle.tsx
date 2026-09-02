"use client";

import { Check } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

/**
 * 「AIインタビュー受付中のみ表示」の絞り込み。
 *
 * 本物の `input[type=checkbox]` にする。以前はリンクに `role="checkbox"` を
 * 当てていたが、チェックボックスと案内されるのに Space が効かず、ブラウザ
 * 既定のスクロールに落ちて画面が飛んでいた。無反応より分かりにくい。
 * ラベルを関連付けることで、文字をタップしても切り替わり、24px に満たなかった
 * タップ領域も文字の分だけ広がる。
 *
 * 絞り込みの状態は URL に載せる規約なので、切り替えたらその URL へ移動する。
 */
export function InterviewOnlyToggle({
  href,
  checked,
}: {
  /** 切り替えた後の一覧のURL。 */
  href: Route;
  checked: boolean;
}) {
  const router = useRouter();

  return (
    <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 py-1.5 text-[13px] font-bold">
      {/*
        見た目は下の span が担う。入力自体は隠すが、`sr-only` で残して
        キーボードとスクリーンリーダーからは通常どおり扱えるようにする。
        `display:none` にすると操作できなくなる。
      */}
      <input
        type="checkbox"
        checked={checked}
        onChange={() => router.push(href)}
        className="peer sr-only"
      />
      {/*
        枠線の有無で寸法が変わらないよう、選択時も border を残して色だけ
        透明にする。太さが変わると行の高さが動いて一覧がずれる。

        フォーカスは入力に当たるが入力は見えないので、隣接する印の側に
        リングを出す。出さないとキーボードで現在地が分からない。
      */}
      <span
        className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-accent ${
          checked
            ? "border-transparent bg-mirai-gradient"
            : "border-mirai-border-light bg-card"
        }`}
        aria-hidden
      >
        {checked && (
          <Check className="h-3 w-3 text-foreground" strokeWidth={3.5} />
        )}
      </span>
      AIインタビュー受付中のみ表示
    </label>
  );
}
