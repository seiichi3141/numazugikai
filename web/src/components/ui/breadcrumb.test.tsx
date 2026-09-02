// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Breadcrumb } from "./breadcrumb";

const items = [{ label: "トップ", href: "/" }, { label: "議案を検索する" }];

describe("Breadcrumb", () => {
  it("href がある項目はリンクにする", () => {
    render(<Breadcrumb items={items} />);

    expect(screen.getByRole("link", { name: "トップ" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("href が無い項目はリンクにしない", () => {
    render(<Breadcrumb items={items} />);

    expect(screen.getByText("議案を検索する")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "議案を検索する" })
    ).not.toBeInTheDocument();
  });

  it("渡した順にすべての項目を出す", () => {
    render(<Breadcrumb items={items} />);

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveTextContent("トップ");
    expect(nav).toHaveTextContent("議案を検索する");
  });

  it("nav ランドマークにする", () => {
    render(<Breadcrumb items={items} />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("1項目でも壊れない", () => {
    render(<Breadcrumb items={[{ label: "トップ", href: "/" }]} />);

    expect(screen.getByRole("link", { name: "トップ" })).toBeInTheDocument();
  });

  describe("支援技術への伝わり方", () => {
    it("パンくずだと分かる名前を付ける", () => {
      // 同じページに補助ナビ・カテゴリ・ページ送りの nav が並ぶので、
      // 名前が無いとどれがパンくずか分からない
      render(<Breadcrumb items={items} />);

      expect(
        screen.getByRole("navigation", { name: "パンくずリスト" })
      ).toBeInTheDocument();
    });

    it("順序のあるリストとして組む", () => {
      // 階層の順序に意味があるので、項目数と順番が伝わる形にする
      render(<Breadcrumb items={items} />);

      expect(screen.getByRole("list")).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("最後の項目を現在地として伝える", () => {
      render(<Breadcrumb items={items} />);

      expect(screen.getByText("議案を検索する")).toHaveAttribute(
        "aria-current",
        "page"
      );
    });

    it("区切りの記号は読み上げない", () => {
      // 「トップ 大なり 議案を検索する」と読まれても意味がない
      const { container } = render(<Breadcrumb items={items} />);

      for (const svg of container.querySelectorAll("svg")) {
        expect(svg).toHaveAttribute("aria-hidden");
      }
    });
  });
});
