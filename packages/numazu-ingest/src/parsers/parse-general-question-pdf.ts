import { KNOWN_ERAS, toHalfWidthDigits } from "./normalize-wareki";

export type ParsedGeneralQuestionItem = {
  sourceKey: string;
  order: number | null;
  parentSourceKey: string | null;
  label: string;
};

export type ParsedGeneralQuestionAppearance = {
  sourceKey: string;
  speakerName: string;
  seatNumber: number | null;
  questionOrder: number | null;
  questionKind: "representative" | "personal" | "other" | "unknown";
  deliveryMethod:
    | "all_at_once"
    | "one_by_one"
    | "combined"
    | "other"
    | "unknown";
  heldOn: string | null;
  items: ParsedGeneralQuestionItem[];
  answerers: string[];
};

export type ParsedGeneralQuestionPdf = {
  sessionLabel: string | null;
  sessionNumber: number | null;
  sessionYear: number | null;
  sourceDates: string[];
  appearances: ParsedGeneralQuestionAppearance[];
};

const speakerPattern =
  /^(?:(\d{1,2})\s*(?:番|席)\s+)?(.+?)(?:\s*[（(](.+?)[）)])?$/;
const topItemPattern = /^(\d{1,2})[.．、\s]+(.+)$/;
const childItemPattern = /^[（(](\d{1,2})[）)]\s*(.+)$/;
const eraBaseYear: Record<string, number> = {
  令和: 2019,
  平成: 1989,
  昭和: 1926,
};

function normalizeLine(value: string): string {
  return toHalfWidthDigits(value)
    .replace(/　/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIsoDate(
  value: string,
  fallbackYear: number | null
): string | null {
  const match = value.match(
    /(?:(令和|平成|昭和)\s*(元|\d{1,2})年|(\d{4})年)?(\d{1,2})月(\d{1,2})日/
  );
  const eraYear =
    match?.[1] && match[2]
      ? eraBaseYear[match[1]] + (match[2] === "元" ? 1 : Number(match[2])) - 1
      : null;
  const year = match?.[3] ? Number(match[3]) : (eraYear ?? fallbackYear);
  if (!match || !year) return null;
  const month = Number(match[4]);
  const day = Number(match[5]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseSessionYear(label: string): number | null {
  const era = KNOWN_ERAS.find((value) => label.includes(value));
  const year = label.match(/(?:令和|平成|昭和)\s*(元|\d{1,2})\s*年/);
  if (!era || !year) return null;
  const base = eraBaseYear[era];
  if (base === undefined) return null;
  return base + (year[1] === "元" ? 1 : Number(year[1])) - 1;
}

function parseMethod(
  label: string
): ParsedGeneralQuestionAppearance["deliveryMethod"] {
  if (/一問一答/.test(label)) return "one_by_one";
  if (/一括質問一括答弁|一括方式/.test(label)) return "all_at_once";
  if (/併用|複合/.test(label)) return "combined";
  return "unknown";
}

function appendLabel(
  item: ParsedGeneralQuestionItem,
  continuation: string
): void {
  item.label = `${item.label}${continuation}`;
}

function addAnswerer(
  appearance: ParsedGeneralQuestionAppearance,
  rawValue: string
): void {
  const value = normalizeLine(rawValue).replace(/\s/g, "");
  if (!value || /^\d+$/.test(value) || /求める者/.test(value)) return;
  const previous = appearance.answerers.at(-1);
  if (previous?.endsWith("委員会") && value === "委員長") {
    appearance.answerers[appearance.answerers.length - 1] =
      `${previous}${value}`;
  } else if (!appearance.answerers.includes(value)) {
    appearance.answerers.push(value);
  }
}

function parseGeneralQuestionTable(
  text: string,
  sessionLabel: string | null,
  parsedSessionYear: number | null,
  sessionNumber: number | null,
  sourceDates: string[]
): ParsedGeneralQuestionPdf {
  const rawLines = text.replace(/\f/g, "\n").split("\n");
  const questionKind: ParsedGeneralQuestionAppearance["questionKind"] =
    /代表質問/.test(text)
      ? "representative"
      : /一\s*般\s*質\s*問/.test(text)
        ? "personal"
        : "unknown";
  const appearances: ParsedGeneralQuestionAppearance[] = [];
  let contentColumn = -1;
  let answerColumn = Math.max(...rawLines.map((line) => line.length)) + 1;
  let heldOn: string | null = null;
  let current: ParsedGeneralQuestionAppearance | null = null;
  let currentTopKey: string | null = null;
  let currentSecondKey: string | null = null;
  let lastItem: ParsedGeneralQuestionItem | null = null;

  for (const rawLine of rawLines) {
    const normalized = normalizeLine(rawLine);
    const parsedDate = parseIsoDate(normalized, parsedSessionYear);
    if (parsedDate && /午前|午後|から/.test(normalized)) {
      heldOn = parsedDate;
    }
    if (/^\s*順番.*要\s*旨/.test(rawLine)) {
      const headingColumn = rawLine.search(/要\s*旨/);
      const nameColumn = rawLine.indexOf("氏");
      contentColumn =
        nameColumn >= 0
          ? Math.min(headingColumn, nameColumn + 11)
          : headingColumn;
      const headerAnswerColumn = rawLine.search(/答\s*弁/);
      if (headerAnswerColumn >= 0) answerColumn = headerAnswerColumn;
      continue;
    }
    if (/答\s*弁/.test(rawLine)) {
      answerColumn = rawLine.search(/答\s*弁/);
      continue;
    }
    const digitLine = toHalfWidthDigits(rawLine);
    const startPrefix = digitLine.match(/^\s*\d+\s+\d+番\s+\d+\s+/)?.[0];
    if (startPrefix) {
      const afterSeat = startPrefix.indexOf("番") + 1;
      contentColumn = afterSeat + startPrefix.slice(afterSeat).search(/\d/);
    }
    if (contentColumn < 0 || answerColumn <= contentColumn) continue;

    const speakerCell = normalizeLine(rawLine.slice(0, contentColumn));
    const contentCell = normalizeLine(
      rawLine.slice(contentColumn, answerColumn)
    );
    const answerCell = rawLine.slice(answerColumn);
    const seatStart = speakerCell.match(/^(\d+)\s+(\d+)番$/);
    const representativeStart = speakerCell.match(/^(\d+)\s+(.+)$/);
    const start = seatStart ?? representativeStart;
    if (start) {
      current = {
        sourceKey: `appearance-${start[1]}`,
        speakerName: "",
        seatNumber: seatStart ? Number(seatStart[2]) : null,
        questionOrder: Number(start[1]),
        questionKind,
        deliveryMethod: "unknown",
        heldOn,
        items: [],
        answerers: [],
      };
      appearances.push(current);
      currentTopKey = null;
      currentSecondKey = null;
      lastItem = null;
    }
    if (!current) continue;

    const seatOnly = speakerCell.match(/^(\d+)番$/);
    if (seatOnly && current.seatNumber === null) {
      current.seatNumber = Number(seatOnly[1]);
    }
    if (
      !current.speakerName &&
      current.seatNumber !== null &&
      speakerCell &&
      !start &&
      !seatOnly &&
      !speakerCell.startsWith("＊")
    ) {
      current.speakerName += speakerCell.replace(/\s/g, "");
    }
    const methodLine = speakerCell.startsWith("＊");
    if (current.deliveryMethod === "unknown" || methodLine) {
      addAnswerer(current, answerCell);
    }
    if (methodLine) current.deliveryMethod = parseMethod(speakerCell);

    const top = contentCell.match(/^(\d+)[.．、\s]+(.+)$/);
    const second = contentCell.match(/^[⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽]\s*(.+)$/);
    const third = contentCell.match(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*(.+)$/);
    const fourth = contentCell.match(/^[アイウエオカキクケコ]\s+(.+)$/);
    if (top) {
      currentTopKey = `${current.sourceKey}-item-${top[1]}`;
      currentSecondKey = null;
      lastItem = {
        sourceKey: currentTopKey,
        order: Number(top[1]),
        parentSourceKey: null,
        label: top[2],
      };
      current.items.push(lastItem);
    } else if (second && currentTopKey) {
      const siblingOrder: number = current.items.filter(
        (item) => item.parentSourceKey === currentTopKey
      ).length;
      currentSecondKey = `${currentTopKey}-${siblingOrder + 1}`;
      lastItem = {
        sourceKey: currentSecondKey,
        order: siblingOrder + 1,
        parentSourceKey: currentTopKey,
        label: second[1],
      };
      current.items.push(lastItem);
    } else if (third && currentSecondKey) {
      const siblingOrder: number = current.items.filter(
        (item) => item.parentSourceKey === currentSecondKey
      ).length;
      lastItem = {
        sourceKey: `${currentSecondKey}-${siblingOrder + 1}`,
        order: siblingOrder + 1,
        parentSourceKey: currentSecondKey,
        label: third[1],
      };
      current.items.push(lastItem);
    } else if (fourth && lastItem) {
      const parentSourceKey: string | null =
        lastItem.parentSourceKey ?? currentTopKey;
      if (parentSourceKey) {
        const siblingOrder: number = current.items.filter(
          (item) => item.parentSourceKey === parentSourceKey
        ).length;
        lastItem = {
          sourceKey: `${parentSourceKey}-kana-${siblingOrder + 1}`,
          order: siblingOrder + 1,
          parentSourceKey,
          label: fourth[1],
        };
        current.items.push(lastItem);
      }
    } else if (
      contentCell &&
      lastItem &&
      !/^(順番|求める者|\d+)$/.test(contentCell)
    ) {
      appendLabel(lastItem, contentCell);
    }
  }
  return {
    sessionLabel,
    sessionNumber,
    sessionYear: parsedSessionYear,
    sourceDates,
    appearances,
  };
}

function parseLegacyGeneralQuestionList(
  text: string,
  sessionLabel: string | null,
  parsedSessionYear: number | null,
  sessionNumber: number | null,
  sourceDates: string[]
): ParsedGeneralQuestionPdf {
  const lines = text.replace(/\f/g, "\n").split("\n");
  const appearances: ParsedGeneralQuestionAppearance[] = [];
  let current: ParsedGeneralQuestionAppearance | null = null;
  let currentTopKey: string | null = null;
  let currentSecondKey: string | null = null;
  let lastItem: ParsedGeneralQuestionItem | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = normalizeLine(rawLine);
    const nextLine = normalizeLine(lines[index + 1] ?? "");
    const compact = line.replace(/\s/g, "");
    const isSpeaker =
      rawLine.trim().length > 0 &&
      /\s/.test(rawLine.trim()) &&
      /^[一-龠々〆ヵヶぁ-んァ-ヶー]{2,12}$/.test(compact) &&
      /^Ⅰ/.test(nextLine);
    if (isSpeaker) {
      const order = appearances.length + 1;
      current = {
        sourceKey: `appearance-${order}`,
        speakerName: compact,
        seatNumber: null,
        questionOrder: order,
        questionKind: "personal",
        deliveryMethod: "unknown",
        heldOn: null,
        items: [],
        answerers: [],
      };
      appearances.push(current);
      currentTopKey = null;
      currentSecondKey = null;
      lastItem = null;
      continue;
    }
    if (!current || !line || /^Ⅰ/.test(line)) continue;

    const top = line.match(/^(\d{1,2})[.．、\s]+(.+)$/);
    const second = line.match(/^[⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽]\s*(.+)$/);
    const third = line.match(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*(.+)$/);
    if (top) {
      currentTopKey = `${current.sourceKey}-item-${top[1]}`;
      currentSecondKey = null;
      lastItem = {
        sourceKey: currentTopKey,
        order: Number(top[1]),
        parentSourceKey: null,
        label: top[2],
      };
      current.items.push(lastItem);
    } else if (second && currentTopKey) {
      const order =
        current.items.filter((item) => item.parentSourceKey === currentTopKey)
          .length + 1;
      currentSecondKey = `${currentTopKey}-${order}`;
      lastItem = {
        sourceKey: currentSecondKey,
        order,
        parentSourceKey: currentTopKey,
        label: second[1],
      };
      current.items.push(lastItem);
    } else if (third && currentSecondKey) {
      const order =
        current.items.filter(
          (item) => item.parentSourceKey === currentSecondKey
        ).length + 1;
      lastItem = {
        sourceKey: `${currentSecondKey}-${order}`,
        order,
        parentSourceKey: currentSecondKey,
        label: third[1],
      };
      current.items.push(lastItem);
    } else if (lastItem && !/^(一般質問|平成|令和|昭和)/.test(line)) {
      appendLabel(lastItem, line);
    }
  }

  return {
    sessionLabel,
    sessionNumber,
    sessionYear: parsedSessionYear,
    sourceDates,
    appearances,
  };
}

function extractSourceDates(
  text: string,
  fallbackYear: number | null
): string[] {
  const normalized = toHalfWidthDigits(text).replace(/　/g, " ");
  const dates = new Set<string>();
  for (const match of normalized.matchAll(
    /((?:令和|平成|昭和)\s*(?:元|\d{1,2})年)\s*(\d{1,2})月\s*((?:\d{1,2}日(?:\s*[、,]\s*)?)+)/g
  )) {
    for (const day of match[3].matchAll(/\d{1,2}/g)) {
      const parsed = parseIsoDate(`${match[1]}${match[2]}月${day[0]}日`, null);
      if (parsed) dates.add(parsed);
    }
  }
  if (fallbackYear !== null) {
    for (const match of normalized.matchAll(/(\d{1,2})月\s*(\d{1,2})日/g)) {
      const parsed = parseIsoDate(`${match[1]}月${match[2]}日`, fallbackYear);
      if (parsed) dates.add(parsed);
    }
  }
  return [...dates].sort();
}

/** `pdftotext -layout` の一般質問通告資料を登壇枠単位へ構造化する。 */
export function parseGeneralQuestionPdf(
  text: string
): ParsedGeneralQuestionPdf {
  const lines = text.replace(/\f/g, "\n").split("\n").map(normalizeLine);
  const sessionLabel =
    lines.find(
      (line) =>
        /第\s*\d+\s*回.*(?:定例会|臨時会)/.test(line) ||
        /(?:令和|平成|昭和).*定例会/.test(line)
    ) ?? null;
  const sessionNumber = sessionLabel
    ? Number(sessionLabel.match(/第\s*(\d+)\s*回/)?.[1] ?? 0) || null
    : null;
  const parsedSessionYear = sessionLabel
    ? parseSessionYear(sessionLabel)
    : null;
  const sourceDates = extractSourceDates(text, parsedSessionYear);
  if (/要\s*旨/.test(text) && /順番[\s\S]{0,30}氏\s*名/.test(text)) {
    return parseGeneralQuestionTable(
      text,
      sessionLabel,
      parsedSessionYear,
      sessionNumber,
      sourceDates
    );
  }
  if (/一般質問（発言順）/.test(lines.join(""))) {
    return parseLegacyGeneralQuestionList(
      text,
      sessionLabel,
      parsedSessionYear,
      sessionNumber,
      sourceDates
    );
  }
  const appearances: ParsedGeneralQuestionAppearance[] = [];
  let heldOn: string | null = null;
  let current: ParsedGeneralQuestionAppearance | null = null;
  let currentTopKey: string | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (/\d{1,2}月\d{1,2}日/.test(line)) {
      heldOn = parseIsoDate(line, parsedSessionYear) ?? heldOn;
      continue;
    }
    const speaker = line.match(/^(?:質問者|登壇者)[:：]\s*(.+)$/)?.[1];
    if (speaker) {
      const parsed = speaker.match(speakerPattern);
      if (!parsed) continue;
      const annotations = parsed[3] ?? "";
      current = {
        sourceKey: `appearance-${appearances.length + 1}`,
        speakerName: parsed[2].replace(/\s+/g, ""),
        seatNumber: parsed[1] ? Number(parsed[1]) : null,
        questionOrder: appearances.length + 1,
        questionKind: /代表質問/.test(annotations)
          ? "representative"
          : /個人質問/.test(annotations)
            ? "personal"
            : "unknown",
        deliveryMethod: parseMethod(annotations),
        heldOn,
        items: [],
        answerers: [],
      };
      appearances.push(current);
      currentTopKey = null;
      continue;
    }
    if (!current) continue;
    const answerers = line.match(/^答弁者[:：]\s*(.+)$/)?.[1];
    if (answerers) {
      current.answerers.push(
        ...answerers
          .split(/[、,]/)
          .map((value) => value.trim())
          .filter(Boolean)
      );
      continue;
    }
    const child = line.match(childItemPattern);
    if (child && currentTopKey) {
      current.items.push({
        sourceKey: `${currentTopKey}-${child[1]}`,
        order: Number(child[1]),
        parentSourceKey: currentTopKey,
        label: child[2],
      });
      continue;
    }
    const top = line.match(topItemPattern);
    if (top) {
      currentTopKey = `${current.sourceKey}-item-${top[1]}`;
      current.items.push({
        sourceKey: currentTopKey,
        order: Number(top[1]),
        parentSourceKey: null,
        label: top[2],
      });
    }
  }
  return {
    sessionLabel,
    sessionNumber,
    sessionYear: parsedSessionYear,
    sourceDates,
    appearances,
  };
}
