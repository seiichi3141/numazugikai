/**
 * テスト中の DOM から議案サムネイルの元パスを取り出す。
 * next/image は src を /_next/image?url=… に包むので、元のパスに戻して比べる。
 * サムネイルは装飾で alt が空なので、それを手がかりに探す。
 */
export function thumbnailSrc(container: HTMLElement): string {
  const src = container.querySelector('img[alt=""]')?.getAttribute("src");
  return decodeURIComponent(src ?? "");
}
