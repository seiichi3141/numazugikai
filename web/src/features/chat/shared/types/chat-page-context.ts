export interface HomeChatBillContext {
  name: string;
  url: string;
  summary?: string;
  tags?: string[];
  isFeatured?: boolean;
}

export interface ChatPageContext {
  type: "home" | "bill";
  bills?: HomeChatBillContext[];
}
