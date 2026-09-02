import { describe, expect, it } from "vitest";
import { normalizeChatMarkdown } from "./normalize-chat-markdown";

describe("normalizeChatMarkdown", () => {
  it.each([
    ["** 議案名**", "**議案名**"],
    ["**議案名 **", "**議案名**"],
    ["[** 議案名 **](/bills/bill-123)", "[**議案名**](/bills/bill-123)"],
  ])("強調記号の内側の空白を除去する: %s", (text, expected) => {
    expect(normalizeChatMarkdown(text)).toBe(expected);
  });

  it.each([
    "2 ** 3 = 8",
    "2 ** 3 ** 4",
    "x ** y ** z",
  ])("強調記号ではない数式表現は変更しない: %s", (text) => {
    expect(normalizeChatMarkdown(text)).toBe(text);
  });

  it.each([
    ["`** literal **` と ** 本文 **", "`** literal **` と **本文**"],
    [
      "```md\n** literal **\n```\n** 本文 **",
      "```md\n** literal **\n```\n**本文**",
    ],
    [
      "~~~md\n** literal **\n~~~\n** 本文 **",
      "~~~md\n** literal **\n~~~\n**本文**",
    ],
    ["`** literal ** と ** 本文 **", "`** literal ** と ** 本文 **"],
    ["``a` ** literal **`` と ** 本文 **", "``a` ** literal **`` と **本文**"],
  ])("コード領域の強調記号は変更しない: %s", (text, expected) => {
    expect(normalizeChatMarkdown(text)).toBe(expected);
  });
});
