// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CouncilSession } from "../../shared/types";
import { CurrentCouncilSession } from "./current-council-session";

const session = {
  id: "s1",
  name: "令和8年6月定例会",
  start_date: "2026-06-01",
  end_date: "2026-06-30",
} as CouncilSession;

const now = new Date("2026-06-15T00:00:00+09:00");

describe("CurrentCouncilSession", () => {
  describe("会期中", () => {
    it("会期中であることと会期名を出す", () => {
      render(
        <CurrentCouncilSession
          session={session}
          closedSession={null}
          now={now}
        />
      );

      expect(screen.getByText("会期中")).toBeInTheDocument();
      expect(screen.getByText("令和8年6月定例会")).toBeInTheDocument();
    });

    it("召集日と閉会予定日を併記する", () => {
      // 割合だけだと寄付の目標額のように読まれる
      render(
        <CurrentCouncilSession
          session={session}
          closedSession={null}
          now={now}
        />
      );

      expect(screen.getByText(/召集/)).toBeInTheDocument();
      expect(screen.getByText(/閉会予定/)).toBeInTheDocument();
    });

    it("会期の進行をプログレスバーで示す", () => {
      render(
        <CurrentCouncilSession
          session={session}
          closedSession={null}
          now={now}
        />
      );

      expect(
        screen.getByRole("progressbar", { name: "会期の進行" })
      ).toBeInTheDocument();
    });
  });

  describe("閉会中", () => {
    it("閉会中であることと終わった会期を出す", () => {
      render(
        <CurrentCouncilSession
          session={null}
          closedSession={session}
          now={now}
        />
      );

      expect(screen.getByText("閉会中")).toBeInTheDocument();
      expect(
        screen.getByText(/令和8年6月定例会は終了しました/)
      ).toBeInTheDocument();
    });

    it("閉会中は進行バーを出さない", () => {
      render(
        <CurrentCouncilSession
          session={null}
          closedSession={session}
          now={now}
        />
      );

      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("直近の会期が無くても壊れない", () => {
      render(
        <CurrentCouncilSession session={null} closedSession={null} now={now} />
      );

      expect(screen.getByText("閉会中")).toBeInTheDocument();
    });
  });

  describe("見出し", () => {
    it("会期状況セクションの見出しになる", () => {
      render(
        <CurrentCouncilSession
          session={session}
          closedSession={null}
          now={now}
        />
      );

      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    });

    it("閉会中でもセクション見出しを出す", () => {
      render(
        <CurrentCouncilSession
          session={null}
          closedSession={session}
          now={now}
        />
      );

      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    });
  });
});
