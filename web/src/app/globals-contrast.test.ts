import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 配色トークンのコントラスト比を検査する。
 *
 * 色を変えたときに WCAG の下限を割ったことへ気づけるようにする。画面を
 * 見て気づける種類の問題ではなく、指摘されるまで残りやすい。
 *
 * 対象は globals.css の実値。定数をテストに書き写すと、CSS を直しても
 * テストが通ってしまう。
 */
const css = readFileSync(join(__dirname, "globals.css"), "utf-8");

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  if (!m) throw new Error(`トークン --${name} が globals.css に見つからない`);
  return m[1];
}

/** sRGB の相対輝度（WCAG 2.x の定義） */
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const channels = [0, 2, 4].map(
    (i) => Number.parseInt(c.slice(i, i + 2), 16) / 255
  );
  const linear = channels.map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** 白いカードの上と、ページ全体の背景の上。文字はこのどちらかに乗る。 */
const WHITE = "#ffffff";
const BODY = token("background");

describe("文字色のコントラスト（WCAG 2.2 AA / 通常の文字は 4.5:1）", () => {
  it.each([
    "color-mirai-text",
    "color-mirai-text-secondary",
    "color-mirai-text-muted",
    "color-mirai-text-placeholder",
    "color-mirai-text-note",
    "color-mirai-text-subtle",
    "primary",
    "primary-accent",
  ])("%s は白地でも本文背景でも 4.5:1 以上", (name) => {
    const color = token(name);
    expect(contrast(color, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color, BODY)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("非テキストのコントラスト（WCAG 2.2 AA / 3:1）", () => {
  it("フォーカスリングの色は白地で 3:1 以上", () => {
    // キーボード操作でどこにいるか分からなくなる
    expect(contrast(token("primary-accent"), WHITE)).toBeGreaterThanOrEqual(3);
  });

  it("フォーカスリングの色はボタンの地の上でも 3:1 以上", () => {
    // ボタン自身が濃い色なので、白地だけ見て決めると埋もれる
    expect(
      contrast(token("primary-accent"), token("color-mirai-gradient-start"))
    ).toBeGreaterThanOrEqual(3);
  });
});
