// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BillDebate } from "../../../shared/types";
import { BillDebatesSection } from "./bill-debates-section";

const debates: BillDebate[] = [
  {
    id: "debate-against",
    seat_number: 7,
    source_url: "https://example.com/minutes#debate-against",
    speaker_name: "沼津 花子",
    stance: "against",
  },
  {
    id: "debate-for",
    seat_number: null,
    source_url: "https://example.com/minutes#debate-for",
    speaker_name: "駿河 太郎",
    stance: "for",
  },
];

describe("BillDebatesSection", () => {
  it("討論者、立場、議席番号と公式記録へのリンクを表示する", () => {
    render(<BillDebatesSection debates={debates} />);

    expect(
      screen.getByRole("heading", { name: "本会議での討論" })
    ).toBeInTheDocument();
    expect(screen.getByText("沼津 花子")).toBeInTheDocument();
    expect(screen.getByText("反対討論")).toBeInTheDocument();
    expect(screen.getByText("議席番号 7")).toBeInTheDocument();
    expect(screen.getByText("駿河 太郎")).toBeInTheDocument();
    expect(screen.getByText("賛成討論")).toBeInTheDocument();

    const againstLink = screen.getByRole("link", {
      name: "公式記録で沼津 花子議員の討論を確認",
    });
    expect(againstLink).toHaveAttribute(
      "href",
      "https://example.com/minutes#debate-against"
    );
    expect(againstLink).toHaveAttribute("target", "_blank");
    expect(againstLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.getByRole("link", {
        name: "公式記録で駿河 太郎議員の討論を確認",
      })
    ).toHaveAttribute("href", "https://example.com/minutes#debate-for");
  });

  it("討論記録がない議案では表示しない", () => {
    const { container } = render(<BillDebatesSection debates={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
