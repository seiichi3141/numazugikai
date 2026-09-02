import type { UIMessage } from "@ai-sdk/react";
import type { ComponentProps } from "react";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Response } from "@/components/ai-elements/response";
import { CHAT_ORIGIN } from "@/features/chat/shared/chat-origin";
import { SUGGEST_INTERVIEW_TOOL_TYPE } from "@/features/chat/shared/constants";
import { normalizeChatMarkdown } from "@/features/chat/shared/utils/normalize-chat-markdown";
import { redactExternalUrls } from "@/features/chat/shared/utils/redact-external-urls";
import { InterviewSuggestionBanner } from "./interview-suggestion-banner";

type RehypePlugins = ComponentProps<typeof Response>["rehypePlugins"];

function sanitizeChatMarkdown(text: string) {
  return normalizeChatMarkdown(redactExternalUrls(text, CHAT_ORIGIN));
}

interface SystemMessageProps {
  message: UIMessage;
  isStreaming: boolean;
  billId?: string;
  billName?: string;
  rehypePlugins?: RehypePlugins;
}

export function SystemMessage({
  message,
  isStreaming,
  billId,
  billName,
  rehypePlugins,
}: SystemMessageProps) {
  return (
    <Message from="assistant" className="justify-start py-0">
      <MessageContent
        variant="flat"
        className="text-sm font-medium leading-[1.8] text-mirai-text"
      >
        {message.parts.map((part, i: number) => {
          if (part.type === "text") {
            return (
              <Response
                key={`${message.id}-${i}`}
                className="break-words"
                rehypePlugins={rehypePlugins}
              >
                {sanitizeChatMarkdown(part.text)}
              </Response>
            );
          }
          if (part.type === "reasoning") {
            return (
              <Reasoning
                key={`${message.id}-${i}`}
                className="w-full"
                isStreaming={isStreaming && i === message.parts.length - 1}
              >
                <ReasoningTrigger />
                <ReasoningContent>
                  {sanitizeChatMarkdown(part.text)}
                </ReasoningContent>
              </Reasoning>
            );
          }
          if (part.type === SUGGEST_INTERVIEW_TOOL_TYPE && billId && billName) {
            return (
              <InterviewSuggestionBanner
                key={`${message.id}-${i}`}
                billId={billId}
                billName={billName}
              />
            );
          }
          return null;
        })}
      </MessageContent>
    </Message>
  );
}
