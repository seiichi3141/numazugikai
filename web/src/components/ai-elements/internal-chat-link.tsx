import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const INTERNAL_PATH = /^\/(?!\/)[A-Za-z0-9/_?&=%#.-]*$/;

export function InternalChatLink({
  href,
  children,
  className,
  node: _node,
  ...props
}: ComponentProps<"a"> & { node?: unknown }) {
  if (!href || !INTERNAL_PATH.test(href)) {
    return (
      <span className="text-mirai-text-muted">
        [外部リンクは表示できません]
      </span>
    );
  }

  return (
    <a
      {...props}
      href={href}
      className={cn(
        "wrap-anywhere font-medium text-primary underline",
        className
      )}
      data-streamdown="link"
    >
      {children}
    </a>
  );
}
