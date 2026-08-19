import type { BillNumberKind } from "../shared/types";
import { toHalfWidthDigits } from "./normalize-wareki";
import { parseBillNumber } from "./parse-bill-number";

/** 会議録から取り出した、議案1件分の当局説明 */
export type BillExplanation = {
  /** 正規化した議案番号（例: "議第58号"） */
  billNumber: string;
  numberKind: BillNumberKind;
  /** 説明の本文。議案ごとに切り出したもの */
  body: string;
};

/** 会議録から取り出した討論1件 */
export type BillDebate = {
  billNumber: string;
  /** 議席番号。読み取れなければ null */
  seatNumber: number | null;
  /** 発言した議員名（会議録の表記そのまま） */
  speakerName: string;
  stance: "for" | "against";
};

/** 発言者の見出し行（"○18番議員（山下富美子）"）。議長・市長などは対象外。 */
const SPEAKER_PATTERN = /○\s*([0-9０-９]{1,2})\s*番議員\s*（\s*([^）]+?)\s*）/g;

/** 議案番号の表記 */
const BILL_NUMBER_SOURCE = "(?:議|報|認|発議)第[0-9０-９]{1,3}号";

/**
 * 討論の立場表明。会議録では次のどちらかの形で書かれる。
 *   「議第50号　…に対する反対討論です。」
 *   「議第30号　…について、反対の立場から意見を述べます。」
 * 立場は必ず議案番号と同じ文の中にあるため、文単位で対応づける。
 */
const STANCE_DECLARATION = new RegExp(
  `(${BILL_NUMBER_SOURCE})(?![^。]*?${BILL_NUMBER_SOURCE}[^。]*?(?:反対|賛成))[^。]{0,200}?(反対|賛成)(?:討論|の立場)`
);

/**
 * 当局説明の切れ目。
 *   「最初に、報第１号は道路事故損害賠償額の決定で、…」
 *   「次に、議第17号は、契約の目的が…」
 * 「報第１号から報第７号までは」のような一括の前置きは個別説明ではないので除く。
 */
const EXPLANATION_HEAD = new RegExp(
  `(?:次に、|最初に、|初めに、|続いて、)?(${BILL_NUMBER_SOURCE})(?!から${BILL_NUMBER_SOURCE}まで)は`,
  "g"
);

/**
 * 本会議の会議録から、議案ごとの当局説明を切り出す。
 *
 * 総務部長らが「次に、報第５号は工事請負契約金額の変更で、内容といたしましては…」
 * の形で議案を1件ずつ説明するため、議案番号を見出しとして分割する。
 *
 * 同じ議案が複数回現れた場合（市長の概要説明と部長の詳細説明など）は、
 * 内容が厚い方を採用する。
 */
export function extractBillExplanations(text: string): BillExplanation[] {
  const matches = [...text.matchAll(EXPLANATION_HEAD)];
  const longest = new Map<string, BillExplanation>();

  matches.forEach((match, index) => {
    const parsed = parseBillNumber(match[1]);
    if (!parsed) return;

    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    const body = text.slice(start, end).trim();
    if (!body) return;

    const current = longest.get(parsed.billNumber);
    if (current && current.body.length >= body.length) return;

    longest.set(parsed.billNumber, {
      billNumber: parsed.billNumber,
      numberKind: parsed.kind,
      body,
    });
  });

  return [...longest.values()];
}

/**
 * 本会議の会議録から、議案ごとの討論（賛成・反対）を取り出す。
 *
 * 「可決」という結果だけでは、その議案に議論があったのかどうかが分からない。
 * 討論があった議案を特定することで、論点のあった議案を見つけられるようにする。
 *
 * 討論の本文はここでは返さない（著作権上、原文は保持せず公式ページへリンクする）。
 * 取り出すのは「誰が」「どの議案に」「賛成・反対どちらの立場で」討論したかという事実のみ。
 */
export function extractDebates(text: string): BillDebate[] {
  const speakers = [...text.matchAll(SPEAKER_PATTERN)];
  const debates: BillDebate[] = [];
  const seen = new Set<string>();

  speakers.forEach((speaker, index) => {
    const start = (speaker.index ?? 0) + speaker[0].length;
    const end = speakers[index + 1]?.index ?? text.length;
    const segment = text.slice(start, end);

    // 立場表明は発言の冒頭で行われる。後半の引用や言及を拾わないよう範囲を絞る
    const declaration = segment.slice(0, 400).match(STANCE_DECLARATION);
    if (!declaration) return;

    const parsed = parseBillNumber(declaration[1]);
    if (!parsed) return;

    const speakerName = speaker[2].trim();
    const key = `${parsed.billNumber}:${speakerName}:${declaration[2]}`;
    if (seen.has(key)) return;
    seen.add(key);

    const seatNumber = Number(toHalfWidthDigits(speaker[1]));
    debates.push({
      billNumber: parsed.billNumber,
      seatNumber: Number.isInteger(seatNumber) ? seatNumber : null,
      speakerName,
      stance: declaration[2] === "反対" ? "against" : "for",
    });
  });

  return debates;
}
