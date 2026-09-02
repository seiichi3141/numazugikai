/**
 * ロゴ画像の生成スクリプト
 *
 * みらい議会＠沼津市のロゴ（富士山を上辺にした吹き出し＋駿河湾の波）から、
 * web/public/img/logo.svg と PWA / OGP 用の PNG をまとめて生成する。
 * PNG はヘッドレス Chrome で描画するため macOS + Google Chrome を前提とする。
 *
 *   node scripts/generate-logo-assets.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), "../web/public");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// globals.css の --primary / 波・冠雪の薄青 / dev・staging 用の識別色
const PRIMARY = "#1b6ca8";
const LIGHT = "#7fb2d4";
const DEV = "#787878";
const STAGING = "#ca8a04";

// 48x48 グリッドで描いた各パーツ
const BODY = "M8 24 L20 8 H28 L40 24 V33 a5 5 0 0 1 -5 5 H23 L12 46 V38 a4 4 0 0 1 -4 -5 Z";
const CAP = "M20 8 H28 L32.9 14.5 L30.3 13.6 L27.2 16.8 L24 13.6 L20.8 16.8 L17.7 13.6 L15.1 14.5 Z";
const WAVE = "M14 28c2.5 0 2.5 2.4 5 2.4s2.5-2.4 5-2.4 2.5 2.4 5 2.4 2.5-2.4 5-2.4";
// 吹き出し本体（x: 8〜40, y: 8〜46）の周囲に余白を取った描画範囲
const VIEW_BOX = "4 5 40 44";
const [W, H] = [40, 44];

const paths = (fg, sub) => `  <path d="${BODY}" fill="${fg}"/>
  <path d="${CAP}" fill="${sub}"/>
  <path d="${WAVE}" stroke="${sub}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;

const logoSvg = `<svg width="${W}" height="${H}" viewBox="${VIEW_BOX}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="みらい議会＠沼津市">
  <title>みらい議会＠沼津市</title>
  <!-- 富士山（平らな山頂と冠雪）を上辺にした吹き出し。中に駿河湾の波。沼津市議会の議論を伝えるサービスの独自ロゴ。scripts/generate-logo-assets.mjs で生成 -->
${paths(PRIMARY, LIGHT)}
</svg>
`;
writeFileSync(join(WEB_PUBLIC, "img/logo.svg"), logoSvg);
console.log("wrote img/logo.svg");

const workDir = mkdtempSync(join(tmpdir(), "logo-assets-"));

/** 正方形 size px の中央にロゴを描いて PNG に書き出す。scale はロゴの高さ / 画像サイズ */
function renderPng({ dest, size, background, fg, sub, scale }) {
  const height = Math.round(size * scale);
  const width = Math.round((height * W) / H);
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${size}px;height:${size}px;background:${background};overflow:hidden}body{display:flex;align-items:center;justify-content:center}svg{width:${width}px;height:${height}px}</style><svg viewBox="${VIEW_BOX}" fill="none" xmlns="http://www.w3.org/2000/svg">${paths(fg, sub)}</svg>`;
  const htmlPath = join(workDir, `${dest.replaceAll("/", "_")}.html`);
  writeFileSync(htmlPath, html);
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--hide-scrollbars",
      "--default-background-color=00000000",
      `--window-size=${size},${size}`,
      `--screenshot=${join(WEB_PUBLIC, dest)}`,
      `file://${htmlPath}`,
    ],
    { stdio: "ignore" }
  );
  console.log("wrote", dest);
}

// PWA アイコンは白背景・中央 72〜76%（maskable の安全領域）、OGP は透過
const white = "#ffffff";
const jobs = [
  { dest: "icons/pwa/icon_android_512.png", size: 512, background: white, fg: PRIMARY, sub: LIGHT, scale: 0.72 },
  { dest: "icons/pwa/icon_android_192.png", size: 192, background: white, fg: PRIMARY, sub: LIGHT, scale: 0.72 },
  { dest: "icons/pwa/icon_ios.png", size: 180, background: white, fg: PRIMARY, sub: LIGHT, scale: 0.76 },
  { dest: "icons/pwa/icon_dev_192_v3.png", size: 192, background: white, fg: DEV, sub: LIGHT, scale: 0.72 },
  { dest: "icons/pwa/icon_staging_192.png", size: 192, background: white, fg: STAGING, sub: LIGHT, scale: 0.72 },
  { dest: "icons/pwa/icon_staging_ios.png", size: 180, background: white, fg: STAGING, sub: LIGHT, scale: 0.76 },
  { dest: "img/ogp-logo.png", size: 378, background: "transparent", fg: PRIMARY, sub: LIGHT, scale: 0.96 },
];
for (const job of jobs) renderPng(job);
