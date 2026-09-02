/** 公開URLをcanonical・sitemap・robotsで使えるorigin形式に揃える。 */
export function getPublicBaseUrl(webUrl: string): string {
  return new URL(webUrl).origin;
}
