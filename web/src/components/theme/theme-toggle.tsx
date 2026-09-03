"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  showLabel?: boolean;
  showDescription?: boolean;
  className?: string;
}

export function ThemeToggle({
  showLabel = false,
  showDescription = false,
  className,
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const switchId = useId();
  const descriptionId = useId();

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "ダークモードを解除" : "ダークモードに切り替え";

  if (showLabel) {
    return (
      <div className={cn("flex items-center justify-between gap-4", className)}>
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mirai-surface-muted text-mirai-text"
            aria-hidden="true"
          >
            <Moon className="size-4" />
          </span>
          <span className="min-w-0">
            <label
              htmlFor={switchId}
              className="block text-sm font-medium text-mirai-text"
            >
              ダークモード
            </label>
            {showDescription && (
              <span
                id={descriptionId}
                className="block text-xs text-muted-foreground"
              >
                画面を暗い配色に変更
              </span>
            )}
          </span>
        </div>
        <Switch
          id={switchId}
          checked={isDark}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          aria-label={label}
          aria-describedby={showDescription ? descriptionId : undefined}
          disabled={!mounted}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-mirai-text", className)}>
      <Sun className="size-4" aria-hidden="true" />
      <Switch
        id={switchId}
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label={label}
        disabled={!mounted}
      />
      <Moon className="size-4" aria-hidden="true" />
    </div>
  );
}
