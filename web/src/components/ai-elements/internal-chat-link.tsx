import type { ComponentProps } from "react";
import { CHAT_ORIGIN } from "@/features/chat/shared/chat-origin";
import { toInternalChatHref } from "@/features/chat/shared/utils/internal-chat-url";
import { cn } from "@/lib/utils";

export function InternalChatLink({
  href,
  children,
  className,
  node: _node,
  ...props
}: ComponentProps<"a"> & { node?: unknown }) {
  const internalHref = href ? toInternalChatHref(href, CHAT_ORIGIN) : null;

  if (!internalHref) {
    return (
      <span className="text-mirai-text-muted">
        [外部リンクは表示できません]
      </span>
    );
  }

  return (
    <a
      {...props}
      href={internalHref}
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
