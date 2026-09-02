"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";

interface ThemeToggleProps {
  showLabel?: boolean;
}

export function ThemeToggle({ showLabel = false }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "ダークモードを解除" : "ダークモードに切り替え";

  return (
    <div className="flex items-center gap-2 text-mirai-text">
      <Sun className="size-4" aria-hidden="true" />
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label={label}
        disabled={!mounted}
      />
      <Moon className="size-4" aria-hidden="true" />
      {showLabel && <span className="text-sm font-medium">ダークモード</span>}
    </div>
  );
}
