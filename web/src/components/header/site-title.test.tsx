// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteTitle } from "./site-title";

describe("SiteTitle", () => {
  it("サービス名を出す", () => {
    render(<SiteTitle />);

    expect(screen.getByText("みらい議会")).toBeInTheDocument();
    expect(screen.getByText("＠沼津市")).toBeInTheDocument();
  });

  it("画像ではなく文字で組む", () => {
    // 画像にすると縮尺の食い違いで小さくなり、拡大でもぼやける
    const { container } = render(<SiteTitle />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("途中で折り返さない", () => {
    // 「みらい議会」と「＠沼津市」が改行で分かれると別物に見える
    const { container } = render(<SiteTitle />);

    expect(container.firstChild).toHaveClass("whitespace-nowrap");
  });
});
