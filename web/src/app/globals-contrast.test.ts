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

function darkToken(name: string): string {
  const darkBlock = css.match(/\.dark\s*\{([\s\S]*?)\n\}/)?.[1];
  if (!darkBlock)
    throw new Error("globals.css に .dark ブロックが見つからない");

  const match = darkBlock.match(
    new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`)
  );
  if (!match) {
    throw new Error(`ダークテーマの --${name} が globals.css に見つからない`);
  }
  return match[1];
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

describe("テーマ変数の構造", () => {
  it("Next.js フォント変数は利用箇所で解決する", () => {
    expect(css).toMatch(
      /@theme inline\s*\{[\s\S]*--font-sans:\s*var\(--font-noto-sans-jp\)/
    );
  });
});

describe("文字色のコントラスト（WCAG 2.2 AA / 通常の文字は 4.5:1）", () => {
  it.each([
    "muted-foreground",
    "color-mirai-text",
    "color-mirai-text-secondary",
    "color-mirai-text-muted",
    "color-mirai-text-placeholder",
    "color-mirai-text-note",
    "color-mirai-text-subtle",
    "color-mirai-reaction-active",
    "color-topic-label",
    "color-stance-against-light",
    "primary",
    "primary-accent",
  ])("%s は白地でも本文背景でも 4.5:1 以上", (name) => {
    const color = token(name);
    expect(contrast(color, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color, BODY)).toBeGreaterThanOrEqual(4.5);
  });

  it("未選択スイッチのトラックはカードとつまみから区別できる", () => {
    const track = token("color-mirai-control-track");
    expect(contrast(track, WHITE)).toBeGreaterThanOrEqual(3);
  });

  it.each([
    "color-mirai-gradient-start",
    "color-mirai-gradient-end",
  ])("フッター文字は %s 上で 4.5:1 以上", (background) => {
    expect(
      contrast(token("color-mirai-footer-text"), token(background))
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe("非テキストのコントラスト（WCAG 2.2 AA / 3:1）", () => {
  it("フォーカスリングの色は白地で 3:1 以上", () => {
    // キーボード操作でどこにいるか分からなくなる
    expect(contrast(token("primary-accent"), WHITE)).toBeGreaterThanOrEqual(3);
  });

  it("警告の文字と境界線は警告背景に対して十分な差がある", () => {
    expect(
      contrast(
        token("color-mirai-warning-text"),
        token("color-mirai-warning-surface")
      )
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        token("color-mirai-warning-border"),
        token("color-mirai-warning-surface")
      )
    ).toBeGreaterThanOrEqual(3);
  });

  it.each([
    "color-topic-affected",
    "color-topic-citizen",
  ])("%s のアイコンは白地で 3:1 以上", (name) => {
    expect(contrast(token(name), WHITE)).toBeGreaterThanOrEqual(3);
  });

  it("小さな件数表示はカード上で 4.5:1 以上", () => {
    expect(contrast(token("color-topic-count"), WHITE)).toBeGreaterThanOrEqual(
      4.5
    );
  });

  it.each([
    ["primary-accent", "color-stance-for-bg"],
    ["color-stance-against", "color-stance-against-bg"],
  ])("%s は状態背景 %s 上で 4.5:1 以上", (text, background) => {
    expect(contrast(token(text), token(background))).toBeGreaterThanOrEqual(
      4.5
    );
  });

  it("フォーカスリングの色はボタンの地の上でも 3:1 以上", () => {
    // ボタン自身が濃い色なので、白地だけ見て決めると埋もれる
    expect(
      contrast(token("primary-accent"), token("color-mirai-gradient-start"))
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("ダークテーマのコントラスト", () => {
  it.each([
    "foreground",
    "muted-foreground",
    "color-mirai-text",
    "color-mirai-text-secondary",
    "color-mirai-text-muted",
    "color-mirai-text-placeholder",
    "color-mirai-reaction-active",
    "color-topic-count",
    "color-topic-label",
    "color-topic-affected",
    "color-topic-industry",
    "color-topic-expert",
    "color-topic-citizen",
    "color-stance-against",
    "color-stance-against-light",
    "color-stance-neutral",
    "color-mirai-success",
    "primary",
    "primary-accent",
  ])("%s はダーク背景で 4.5:1 以上", (name) => {
    expect(
      contrast(darkToken(name), darkToken("background"))
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("カード上の本文色は 4.5:1 以上", () => {
    expect(
      contrast(darkToken("card-foreground"), darkToken("card"))
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("主要ボタンの文字色は 4.5:1 以上", () => {
    expect(
      contrast(darkToken("primary-foreground"), darkToken("primary"))
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("境界線はページ背景に対して 3:1 以上", () => {
    expect(
      contrast(darkToken("border"), darkToken("background"))
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(darkToken("border"), darkToken("card"))
    ).toBeGreaterThanOrEqual(3);
  });

  it("未選択スイッチのトラックはカードとつまみから区別できる", () => {
    expect(
      contrast(darkToken("color-mirai-control-track"), darkToken("card"))
    ).toBeGreaterThanOrEqual(3);
  });

  it.each([
    "color-mirai-gradient-start",
    "color-mirai-gradient-end",
  ])("フッター文字は %s 上で 4.5:1 以上", (background) => {
    expect(
      contrast(darkToken("color-mirai-footer-text"), darkToken(background))
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("警告の文字と境界線は警告背景に対して十分な差がある", () => {
    expect(
      contrast(
        darkToken("color-mirai-warning-text"),
        darkToken("color-mirai-warning-surface")
      )
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        darkToken("color-mirai-warning-border"),
        darkToken("color-mirai-warning-surface")
      )
    ).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["primary-accent", "color-stance-for-bg"],
    ["color-stance-against", "color-stance-against-bg"],
  ])("%s は状態背景 %s 上で 4.5:1 以上", (text, background) => {
    expect(
      contrast(darkToken(text), darkToken(background))
    ).toBeGreaterThanOrEqual(4.5);
  });
});
