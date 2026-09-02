const JAPANESE_CHARACTER_PATTERN =
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

function countRun(text: string, index: number, character: string): number {
  let end = index;
  while (text[end] === character) {
    end += 1;
  }
  return end - index;
}

function normalizeStrongMarkers(text: string): string {
  return text.replace(
    /\*\*([^*\n]+?)\*\*/g,
    (match, content: string, offset: number, source: string) => {
      const normalizedContent = content.trim();
      const isLinkLabel =
        source[offset - 1] === "[" && source[offset + match.length] === "]";
      const shouldNormalize =
        normalizedContent !== content &&
        (JAPANESE_CHARACTER_PATTERN.test(normalizedContent) || isLinkLabel);

      return shouldNormalize ? `**${normalizedContent}**` : match;
    }
  );
}

function findInlineCodeEnd(
  text: string,
  start: number,
  delimiterLength: number
): number {
  let index = start + delimiterLength;
  while (index < text.length) {
    const nextDelimiter = text.indexOf("`", index);
    if (nextDelimiter === -1) {
      return text.length;
    }

    const runLength = countRun(text, nextDelimiter, "`");
    if (runLength === delimiterLength) {
      return nextDelimiter + runLength;
    }
    index = nextDelimiter + runLength;
  }
  return text.length;
}

function findFenceEnd(
  text: string,
  start: number,
  character: "`" | "~",
  delimiterLength: number
): number {
  let lineStart = text.indexOf("\n", start + delimiterLength);
  while (lineStart !== -1) {
    lineStart += 1;
    let delimiterStart = lineStart;
    while (delimiterStart < lineStart + 3 && text[delimiterStart] === " ") {
      delimiterStart += 1;
    }

    const runLength = countRun(text, delimiterStart, character);
    const lineEnd = text.indexOf("\n", delimiterStart + runLength);
    const afterDelimiter = text.slice(
      delimiterStart + runLength,
      lineEnd === -1 ? text.length : lineEnd
    );
    if (runLength >= delimiterLength && afterDelimiter.trim() === "") {
      return lineEnd === -1 ? text.length : lineEnd + 1;
    }
    lineStart = lineEnd;
  }
  return text.length;
}

function isFenceStart(text: string, index: number): boolean {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  return index - lineStart <= 3 && text.slice(lineStart, index).trim() === "";
}

/** コード領域を保ったまま、強調記号の内側に入った空白を除く。 */
export function normalizeChatMarkdown(text: string): string {
  let result = "";
  let plainTextStart = 0;
  let index = 0;

  while (index < text.length) {
    const character = text[index];
    if (character !== "`" && character !== "~") {
      index += 1;
      continue;
    }

    const delimiterLength = countRun(text, index, character);
    const isFence = delimiterLength >= 3 && isFenceStart(text, index);
    if (character === "~" && !isFence) {
      index += delimiterLength;
      continue;
    }

    result += normalizeStrongMarkers(text.slice(plainTextStart, index));
    const codeEnd = isFence
      ? findFenceEnd(text, index, character, delimiterLength)
      : findInlineCodeEnd(text, index, delimiterLength);
    result += text.slice(index, codeEnd);
    index = codeEnd;
    plainTextStart = codeEnd;
  }

  return result + normalizeStrongMarkers(text.slice(plainTextStart));
}
