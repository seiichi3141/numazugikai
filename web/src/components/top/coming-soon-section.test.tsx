// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComingSoonSection } from "./coming-soon-section";

describe("ComingSoonSection", () => {
  it("無効ならセクションを表示しない", () => {
    render(<ComingSoonSection bills={null} />);

    expect(
      screen.queryByRole("heading", { name: "これから掲載される議案" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("有効なら従来の空状態を表示する", () => {
    render(<ComingSoonSection bills={[]} />);

    expect(
      screen.getByRole("heading", { name: "これから掲載される議案" })
    ).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
