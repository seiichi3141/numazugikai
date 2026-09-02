"use client";

import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import type { HomeChatBillContext } from "@/features/chat/shared/types/chat-page-context";
import { ChatButton } from "./chat-button";

interface HomeChatClientProps {
  currentDifficulty: DifficultyLevelEnum;
  bills: HomeChatBillContext[];
}

/**
 * トップページ用のチャット機能を提供するコンポーネント
 */
export function HomeChatClient({
  currentDifficulty,
  bills,
}: HomeChatClientProps) {
  return (
    <ChatButton
      difficultyLevel={currentDifficulty}
      pageContext={{
        type: "home",
        bills,
      }}
    />
  );
}
