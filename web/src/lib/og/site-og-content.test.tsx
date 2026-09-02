// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteOgContent } from "./site-og-content";

describe("SiteOgContent", () => {
  it("有効な機能と非公式サービスであることを表示する", () => {
    render(
      <SiteOgContent
        logoDataUrl="data:image/png;base64,logo"
        screenshotDataUrl="data:image/png;base64,screenshot"
      />
    );

    expect(screen.getByText(/議案を知る.*探す.*審議を追う/)).toBeTruthy();
    expect(
      screen.getByText("沼津市・沼津市議会の公式サービスではありません")
    ).toBeTruthy();
    expect(screen.queryByText(/意見を届ける/)).toBeNull();
  });

  it("サイト画面の上へスマートフォンフレームを重ねる", () => {
    render(
      <SiteOgContent
        logoDataUrl="data:image/png;base64,logo"
        screenshotDataUrl="data:image/png;base64,screenshot"
      />
    );

    const preview = screen.getByAltText("みらい議会＠沼津市のモバイル表示");
    const frame = screen.getByRole("img", { name: "スマートフォンフレーム" });
    expect(preview.compareDocumentPosition(frame)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});
