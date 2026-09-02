/** スクリーンショット対象として安全に扱える HTTP(S) URL に正規化する。 */
export function validateTargetUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("OG screenshot URL must use http or https");
  }
  return url.toString();
}
