"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { routes } from "@/lib/routes";
import { RubyToggle } from "@/lib/rubyful";

/** メニューから辿れる主要ページ。トップ以外は本文からの導線が弱いのでここに置く。 */
const MENU_LINKS = [
  { label: "トップ", href: routes.home() },
  { label: "議案を検索する", href: routes.billsList() },
  { label: "定例会の一覧", href: routes.gikaiSessions() },
] as const;

export function HamburgerMenu() {
  // ヘッダーはページをまたいで残るので、リンクを押したら自分で閉じる
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          aria-label="メニューを開く"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 flex flex-col gap-3" align="end">
        <nav aria-label="メインメニュー">
          <ul className="flex flex-col">
            {MENU_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-2 text-sm font-medium hover:bg-muted"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t pt-3">
          <RubyToggle />
        </div>
      </PopoverContent>
    </Popover>
  );
}
