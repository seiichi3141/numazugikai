// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CouncilSession } from "@/features/council-sessions/shared/types";
import { LatestRegularSessionHeading } from "./latest-regular-session-heading";

const session: CouncilSession = {
  id: "session-1",
  name: "令和8年第13回（6月）定例会",
  slug: "2026-13",
  source_url: null,
  start_date: "2026-06-05",
  end_date: "2026-06-30",
  is_active: false,
  created_at: "2026-06-01",
  updated_at: "2026-06-01",
};

describe("LatestRegularSessionHeading", () => {
  it("表示対象の会期名と会期別ページへのリンクを表示する", () => {
    render(<LatestRegularSessionHeading session={session} />);

    expect(
      screen.getByRole("heading", {
        name: "令和8年第13回（6月）定例会の議案",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/gikai/2026-13/bills"
    );
  });

  it("slugがない会期もリンクなしで会期名を表示する", () => {
    render(
      <LatestRegularSessionHeading session={{ ...session, slug: null }} />
    );

    expect(
      screen.getByRole("heading", {
        name: "令和8年第13回（6月）定例会の議案",
      })
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
