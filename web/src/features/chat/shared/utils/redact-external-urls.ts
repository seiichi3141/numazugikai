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

/** AI回答に含まれる外部URL文字列をMarkdown描画前に除去する。 */
export function redactExternalUrls(text: string): string {
  return text
    .replace(MARKDOWN_EXTERNAL_LINK_PATTERN, BLOCKED_LINK_TEXT)
    .replace(ANGLE_EXTERNAL_LINK_PATTERN, BLOCKED_LINK_TEXT)
    .replace(SCRIPT_URL_PATTERN, BLOCKED_LINK_TEXT)
    .replace(BARE_EXTERNAL_URL_PATTERN, BLOCKED_LINK_TEXT)
    .replace(EMAIL_ADDRESS_PATTERN, BLOCKED_LINK_TEXT)
    .replace(BARE_DOMAIN_PATTERN, BLOCKED_LINK_TEXT);
}
