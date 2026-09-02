// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HamburgerMenu } from "./hamburger-menu";

describe("HamburgerMenu", () => {
  it("開くと主要ページへのリンクが並ぶ", async () => {
    render(<HamburgerMenu />);
    await userEvent.click(
      screen.getByRole("button", { name: "メニューを開く" })
    );

    const nav = screen.getByRole("navigation", { name: "メインメニュー" });
    const links = nav.querySelectorAll("a");
    expect(
      [...links].map((a) => [a.textContent, a.getAttribute("href")])
    ).toEqual([
      ["トップ", "/"],
      ["議案を検索する", "/bills"],
      ["定例会の一覧", "/gikai"],
    ]);
  });

  it("リンクを押すとメニューが閉じる", async () => {
    render(<HamburgerMenu />);
    await userEvent.click(
      screen.getByRole("button", { name: "メニューを開く" })
    );
    await userEvent.click(screen.getByRole("link", { name: "定例会の一覧" }));

    expect(
      screen.queryByRole("navigation", { name: "メインメニュー" })
    ).not.toBeInTheDocument();
  });
});
