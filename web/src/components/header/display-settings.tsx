"use client";

import { SlidersHorizontal } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RubyToggle } from "@/lib/rubyful";
import { cn } from "@/lib/utils";

interface DisplaySettingsControlsProps {
  className?: string;
}

export function DisplaySettingsControls({
  className,
}: DisplaySettingsControlsProps) {
  const controlClassName = "rounded-xl px-3 py-2.5";

  return (
    <div className={cn("space-y-1", className)}>
      <RubyToggle className={controlClassName} showDescription />
      <ThemeToggle className={controlClassName} showLabel showDescription />
    </div>
  );
}

export function DisplaySettingsPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="hidden h-10 px-3 xl:flex"
          aria-label="表示設定を開く"
        >
          <SlidersHorizontal aria-hidden="true" />
          <span>表示設定</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <div className="px-3 pb-2 pt-1">
          <p className="font-bold text-mirai-text">表示設定</p>
          <p className="text-xs text-muted-foreground">
            読みやすさと画面の見た目を変更できます
          </p>
        </div>
        <DisplaySettingsControls />
      </PopoverContent>
    </Popover>
  );
}
