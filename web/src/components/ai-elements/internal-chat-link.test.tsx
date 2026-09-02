// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InternalChatLink } from "./internal-chat-link";

describe("InternalChatLink", () => {
  it.each([
    "/",
    "/bills/bill-123",
    "/bills/bill-123/opinions",
    "/preview/bills/bill-123?token=test-token",
    "/privacy",
  ])("本サービス内の相対リンクを表示する: %s", (href) => {
    render(<InternalChatLink href={href}>内部ページ</InternalChatLink>);

    expect(screen.getByRole("link", { name: "内部ページ" })).toHaveAttribute(
      "href",
      href
    );
  });

  it.each([
    "https://example.com/path",
    "https://mirai-gikai.example/bills/bill-123",
    "//example.com/path",
    "mailto:contact@example.com",
    "javascript:alert(1)",
  ])("外部リンクを表示しない: %s", (href) => {
    render(<InternalChatLink href={href}>外部サイト</InternalChatLink>);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("[外部リンクは表示できません]")).toBeVisible();
    expect(screen.queryByText("外部サイト")).not.toBeInTheDocument();
  });
});
