import { describe, expect, it } from "vitest";
import { normalizeHtmlForContentHash } from "./normalize-html-for-content-hash";

describe("normalizeHtmlForContentHash", () => {
  it("Incapsulaの動的なquery値をハッシュ対象から除外する", () => {
    const first = `<main>議案一覧</main><script type="text/javascript" src="/_Incapsula_Resource?SWJIYLWA=token&ns=1&cb=123" async></script>`;
    const second = `<main>議案一覧</main><script type="text/javascript" src="/_Incapsula_Resource?SWJIYLWA=token&ns=2&cb=4567" async></script>`;

    expect(normalizeHtmlForContentHash(first)).toBe(
      normalizeHtmlForContentHash(second)
    );
    expect(normalizeHtmlForContentHash(first)).toBe("<main>議案一覧</main>");
  });

  it("属性順や引用符が異なるIncapsula scriptも除外する", () => {
    const html =
      "<main>本文</main><script async src='/_Incapsula_Resource?ns=3&cb=789'></script>";

    expect(normalizeHtmlForContentHash(html)).toBe("<main>本文</main>");
  });

  it("通常のscriptと本文は変更しない", () => {
    const html =
      '<main>議案一覧</main><script src="/assets/application.js"></script>';

    expect(normalizeHtmlForContentHash(html)).toBe(html);
    expect(
      normalizeHtmlForContentHash(html.replace("議案一覧", "会期日程"))
    ).not.toBe(normalizeHtmlForContentHash(html));
  });
});
