"use client";

import { type ComponentProps, memo } from "react";
import rehypeSanitize from "rehype-sanitize";
import { Streamdown } from "streamdown";
import { CHAT_ORIGIN } from "@/features/chat/shared/chat-origin";
import { cn } from "@/lib/utils";
import { InternalChatLink } from "./internal-chat-link";

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, components, rehypePlugins, ...props }: ResponseProps) => (
    <Streamdown
      defaultOrigin={CHAT_ORIGIN}
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      components={{ ...components, a: InternalChatLink }}
      rehypePlugins={[rehypeSanitize, ...(rehypePlugins ?? [])]}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
