// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { Check } from "lucide-react";
import type { Route } from "next";
import { describe, expect, it } from "vitest";
import { FilterChip } from "./filter-chip";

const href = "/bills?status=enacted" as Route;

describe("FilterChip", () => {
  it("ラベルと件数を出す", () => {
    render(<FilterChip href={href} active={false} label="可決" count={78} />);

    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("可決");
    expect(link).toHaveTextContent("78");
  });

  it("渡した href へのリンクにする", () => {
    render(<FilterChip href={href} active={false} label="可決" count={78} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", href);
  });

  it("0件でも件数を出す", () => {
    // 0件のチップも押せる状態で残す。件数が消えると選べるのか分からない
    render(<FilterChip href={href} active={false} label="否決" count={0} />);

    expect(screen.getByRole("link")).toHaveTextContent("0");
  });

  it("アイコンは支援技術から隠す", () => {
    // ラベルの隣の飾りで、読み上げると「可決 可決」のように重複する
    const { container } = render(
      <FilterChip
        href={href}
        active={false}
        label="可決"
        count={78}
        icon={Check}
      />
    );

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden");
  });

  it("アイコンなしでも描画できる", () => {
    const { container } = render(
      <FilterChip href={href} active={false} label="医療・福祉" count={17} />
    );

    expect(container.querySelector("svg")).toBeNull();
  });

  describe("読み上げ", () => {
    it("件数に単位を付けて読ませる", () => {
      // 「可決78」とだけ読まれると、78 が件数だと分からない。
      // 目では数字が小さく別色で件数と分かるが、その手がかりは音声に残らない
      render(<FilterChip href={href} active={false} label="可決" count={78} />);

      expect(
        screen.getByRole("link", { name: "可決 78件" })
      ).toBeInTheDocument();
    });

    it("0件でも件数として読ませる", () => {
      // 「否決0」だと、否決が0件なのか項目名なのか区別できない
      render(<FilterChip href={href} active={false} label="否決" count={0} />);

      expect(
        screen.getByRole("link", { name: "否決 0件" })
      ).toBeInTheDocument();
    });

    it("選択中は押された状態として伝える", () => {
      // aria-current は「現在のページ／手順」を表すもので、絞り込みの
      // 選択状態には aria-pressed が合う
      render(<FilterChip href={href} active label="可決" count={78} />);

      expect(screen.getByRole("link")).toHaveAttribute("aria-pressed", "true");
    });

    it("未選択も押されていない状態として伝える", () => {
      // 属性ごと消すと「押せるが今は押していない」ことが伝わらない
      render(<FilterChip href={href} active={false} label="可決" count={78} />);

      expect(screen.getByRole("link")).toHaveAttribute("aria-pressed", "false");
    });
  });
});
