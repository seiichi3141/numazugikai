"use client";

import { Languages } from "lucide-react";
import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useRubyToggle } from "./use-ruby-toggle";

interface RubyToggleProps {
  className?: string;
  showDescription?: boolean;
}

export function RubyToggle({
  className,
  showDescription = false,
}: RubyToggleProps) {
  const { rubyEnabled, handleRubyToggle } = useRubyToggle();
  const switchId = useId();
  const descriptionId = useId();

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mirai-surface-muted text-mirai-text"
          aria-hidden="true"
        >
          <Languages className="size-4" />
        </span>
        <div className="min-w-0">
          <label
            htmlFor={switchId}
            className="block text-sm font-medium text-mirai-text"
          >
            ふりがな表示
          </label>
          {showDescription && (
            <span
              id={descriptionId}
              className="block text-xs text-muted-foreground"
            >
              漢字の読みを表示
            </span>
          )}
        </div>
      </div>
      <Switch
        id={switchId}
        checked={rubyEnabled}
        onCheckedChange={handleRubyToggle}
        aria-label="ふりがな表示の切り替え"
        aria-describedby={showDescription ? descriptionId : undefined}
      />
    </div>
  );
}
