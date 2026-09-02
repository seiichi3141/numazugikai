import { Children, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { OgFrame } from "./og-frame";

function getContentStyle(contentBackgroundImage?: string) {
  const frame = OgFrame({
    logoDataUrl: null,
    children: <div>本文</div>,
    contentBackgroundImage,
  }) as ReactElement<{ children: ReactElement }>;
  const border = Children.toArray(frame.props.children)[0] as ReactElement<{
    children: ReactElement[];
  }>;
  const content = Children.toArray(border.props.children)[0] as ReactElement<{
    style: Record<string, unknown>;
  }>;
  return content.props.style;
}

describe("OgFrame", () => {
  it("背景画像が未指定なら未定義のstyle値を渡さない", () => {
    expect(getContentStyle()).not.toHaveProperty("backgroundImage");
  });

  it("背景画像が指定されていればstyleへ設定する", () => {
    expect(getContentStyle("linear-gradient(white, blue)")).toMatchObject({
      backgroundImage: "linear-gradient(white, blue)",
    });
  });
});
