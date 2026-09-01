import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FONT_FETCH_TIMEOUT_MS = 3000;
/** 取得に失敗したあと、次に試すまでの間隔。障害中に毎回タイムアウトを待たない */
const RETRY_AFTER_FAILURE_MS = 60_000;

/** タイムアウト付きfetch */
async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = FONT_FETCH_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 結果を Promise ごとキャッシュする。
 *
 * 値を待ってからキャッシュすると、同じ議案が複数の SNS から同時に取られた
 * ときに全員がフォントを取りに行く。Promise を共有すれば1回で済む。
 * 失敗は一定時間だけ覚えて、その間は再試行しない。
 */
export function cachedLoader<T>(load: () => Promise<T | null>) {
  let inflight: Promise<T | null> | null = null;
  let failedAt = 0;
  return (): Promise<T | null> => {
    if (inflight) return inflight;
    if (Date.now() - failedAt < RETRY_AFTER_FAILURE_MS) {
      return Promise.resolve(null);
    }
    inflight = load().then((value) => {
      if (value === null) {
        inflight = null;
        failedAt = Date.now();
      }
      return value;
    });
    return inflight;
  };
}

/**
 * OGP に載せるサービスロゴを data URL で返す。
 * 画像の取得に失敗しても OGP 自体は返せるよう null で受ける。
 */
export const loadOgLogo = cachedLoader<string>(async () => {
  try {
    const logoPath = join(process.cwd(), "public/img/ogp-logo.png");
    const buf = await readFile(logoPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
});

/**
 * Google Fontsからフォントデータを取得する。
 * User-Agentを送らないことでTTF形式を取得する（Satoriはwoff2非対応）。
 */
export const loadOgFont = cachedLoader<ArrayBuffer>(async () => {
  try {
    const url =
      "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@800&display=swap";
    const cssRes = await fetchWithTimeout(url);
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const fontUrl = css
      .match(/src:\s*url\(([^)]+)\)\s*format\('(opentype|truetype)'\)/)?.[1]
      ?.replace(/^["']|["']$/g, "");
    if (!fontUrl) return null;
    const fontRes = await fetchWithTimeout(fontUrl);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
});
