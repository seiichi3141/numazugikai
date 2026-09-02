const INTERNAL_PATH = /^\/(?!\/)[A-Za-z0-9/_?&=%#.-]*$/;

/** AI回答のリンク先を、安全な本サービス内パスへ変換する。 */
export function toInternalChatHref(
  href: string,
  currentOrigin?: string
): string | null {
  if (INTERNAL_PATH.test(href)) {
    return href;
  }

  if (!currentOrigin) {
    return null;
  }

  try {
    const origin = new URL(currentOrigin);
    const url = new URL(href);

    if (
      !["http:", "https:"].includes(origin.protocol) ||
      url.origin !== origin.origin ||
      url.username ||
      url.password
    ) {
      return null;
    }

    const internalPath = `${url.pathname}${url.search}${url.hash}`;
    return INTERNAL_PATH.test(internalPath) ? internalPath : null;
  } catch {
    return null;
  }
}
