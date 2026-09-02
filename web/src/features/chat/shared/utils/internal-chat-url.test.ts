import { describe, expect, it } from "vitest";
import { toInternalChatHref } from "./internal-chat-url";

const CURRENT_ORIGIN = "https://mirai-numazu.com";

describe("toInternalChatHref", () => {
  it.each([
    ["/", "/"],
    ["/bills/bill-123", "/bills/bill-123"],
    [
      "https://mirai-numazu.com/bills/bill-123?preview=1#summary",
      "/bills/bill-123?preview=1#summary",
    ],
  ])("本サービス内のリンクを相対パスにする: %s", (href, expected) => {
    expect(toInternalChatHref(href, CURRENT_ORIGIN)).toBe(expected);
  });

  it.each([
    "https://example.com/bills/bill-123",
    "https://mirai-numazu.com.evil.example/bills/bill-123",
    "https://mirai-numazu.com:444/bills/bill-123",
    "https://user@mirai-numazu.com/bills/bill-123",
    "//mirai-numazu.com/bills/bill-123",
    "javascript:alert(1)",
  ])("外部または不正なリンクを拒否する: %s", (href) => {
    expect(toInternalChatHref(href, CURRENT_ORIGIN)).toBeNull();
  });
});
