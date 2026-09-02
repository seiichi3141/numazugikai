const MARKDOWN_EXTERNAL_LINK_PATTERN =
  /!?\[[^\]]*\]\(\s*(?:<(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|javascript:|data:|vbscript:|www\.|\/\/(?=[^\s>]*\.))[^>]+>|(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|javascript:|data:|vbscript:|www\.|\/\/(?=[^\s)]*\.))(?:[^()\s]|\([^)]*\))*)\s*\)/gi;

const ANGLE_EXTERNAL_LINK_PATTERN =
  /<(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|javascript:|data:|vbscript:|www\.|\/\/(?=[^\s>]*\.))[^\s>]+>/gi;

const SCRIPT_URL_PATTERN =
  /(?:javascript|vbscript):[^\s<>{}[\]"'`()、。！？]*(?:\([^)]*\))?/gi;

const BARE_EXTERNAL_URL_PATTERN =
  /(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|javascript:|data:|vbscript:|www\.)[^\s<>{}[\]"'`()、。！？]+|\/\/(?=[^\s<>{}[\]"'`()、。！？]*\.)[^\s<>{}[\]"'`()、。！？]+/gi;

const EMAIL_ADDRESS_PATTERN =
  /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+(?:[\p{L}]{2,63}|xn--[a-z0-9-]{2,59})/giu;

const BARE_DOMAIN_PATTERN =
  /(?<![/@\p{L}\p{N}_.-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+(?:[\p{L}]{2,63}|xn--[a-z0-9-]{2,59})(?::\d{1,5})?(?:\/[^\s<>{}[\]"'`()、。！？]*)?/giu;

const BLOCKED_LINK_TEXT = "[外部リンクは表示できません]";
const PROTECTED_ORIGIN_TOKEN = "\uE000INTERNAL_CHAT_ORIGIN\uE001";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function protectCurrentOrigin(text: string, currentOrigin?: string) {
  if (!currentOrigin) {
    return { text, origin: null };
  }

  try {
    const originUrl = new URL(currentOrigin);
    if (!["http:", "https:"].includes(originUrl.protocol)) {
      return { text, origin: null };
    }

    const origin = originUrl.origin;
    return {
      text: text.replace(
        new RegExp(`${escapeRegExp(origin)}(?=\\/|[?#]|$)`, "gi"),
        PROTECTED_ORIGIN_TOKEN
      ),
      origin,
    };
  } catch {
    return { text, origin: null };
  }
}

/** AI回答に含まれる外部URL文字列をMarkdown描画前に除去する。 */
export function redactExternalUrls(
  text: string,
  currentOrigin?: string
): string {
  const protectedText = protectCurrentOrigin(text, currentOrigin);
  const redactedText = protectedText.text
    .replace(MARKDOWN_EXTERNAL_LINK_PATTERN, BLOCKED_LINK_TEXT)
    .replace(ANGLE_EXTERNAL_LINK_PATTERN, BLOCKED_LINK_TEXT)
    .replace(SCRIPT_URL_PATTERN, BLOCKED_LINK_TEXT)
    .replace(BARE_EXTERNAL_URL_PATTERN, BLOCKED_LINK_TEXT)
    .replace(EMAIL_ADDRESS_PATTERN, BLOCKED_LINK_TEXT)
    .replace(BARE_DOMAIN_PATTERN, BLOCKED_LINK_TEXT);

  return protectedText.origin
    ? redactedText.replaceAll(PROTECTED_ORIGIN_TOKEN, protectedText.origin)
    : redactedText;
}
