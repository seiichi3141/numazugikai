import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { validateTargetUrl } from "./capture-og-site-utils.mjs";

const DEFAULT_URL = "https://numazugikai-web.vercel.app";
const DEFAULT_OUTPUT = "web/public/img/og/site-mobile.png";
const targetUrl = process.env.OG_SCREENSHOT_URL || process.argv[2] || DEFAULT_URL;
const outputPath = resolve(
  process.env.OG_SCREENSHOT_OUTPUT || process.argv[3] || DEFAULT_OUTPUT
);

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  const response = await page.goto(validateTargetUrl(targetUrl), {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  if (!response?.ok()) {
    throw new Error(
      `OG screenshot page returned ${response?.status() ?? "no response"}`
    );
  }
  await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
  const hero = page.locator("section[aria-labelledby='numazu-hero-heading']");
  await hero.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(() => document.fonts.status === "loaded", undefined, {
    timeout: 30_000,
  });
  const heroImage = hero.locator("img");
  await heroImage.waitFor({ state: "visible", timeout: 30_000 });
  await heroImage.evaluate(async (image) => {
    if (!(image instanceof HTMLImageElement) || image.naturalWidth === 0) {
      throw new Error("The OGP hero image failed to load");
    }
    await image.decode();
  });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        caret-color: transparent !important;
        transition: none !important;
      }
      html { scrollbar-width: none !important; }
      ::-webkit-scrollbar { display: none !important; }
    `,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await page.screenshot({
    path: outputPath,
    fullPage: false,
    animations: "disabled",
  });
  await context.close();
  console.log(`Captured ${targetUrl} -> ${outputPath}`);
} finally {
  await browser.close();
}
