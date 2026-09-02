// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NumazuHero } from "./numazu-hero";

describe("NumazuHero", () => {
  it("沼津の紹介から議案一覧へ案内する", () => {
    render(<NumazuHero />);

    expect(
      screen.getByRole("region", {
        name: "海と富士山を望むまち、沼津。",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "海と富士山を望むまち、沼津。",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /議案を見てみる/ })
    ).toHaveAttribute("href", "/bills");
    expect(
      screen.getByRole("img", {
        name: "夕暮れの海辺を表現した沼津の風景イメージ",
      })
    ).toBeInTheDocument();
  });
});
