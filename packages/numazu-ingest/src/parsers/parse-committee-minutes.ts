import { parseBillNumber } from "./parse-bill-number";

/** 委員会での議案1件（または一括審査グループ）の審査記録 */
export type CommitteeBillReview = {
  /** 審査された議案番号（一括審査の場合は複数） */
  billNumbers: string[];
  /** 当局（課長・部長ら）の説明。委員会の会議記録から切り出したもの */
  explanation: string;
  /** 委員による質疑の発言数。0なら質疑なしで審査された */
  questionCount: number;
};

const BILL_NUMBER_SOURCE = "(?:議|報|認|発議|請願|陳情)第[0-9０-９]{1,3}号";

/**
 * 委員長による議題宣告。
 *   「最初に、議第58号　沼津市印鑑条例の一部改正を議題といたします。」
 *   「次に、議第60号及び議第64号、以上2件を一括議題といたします。」
 */
const AGENDA_DECLARATION = new RegExp(
  `((?:${BILL_NUMBER_SOURCE})(?:[^\\n]{0,120}?(?:${BILL_NUMBER_SOURCE}))*)[^\\n]{0,80}?議題といたします`,
  "g"
);

/** 発言の区切り（amivoiceHtmlToText が出力する形式） */
const SPEAKER_LINE = /^○(.+)$/;

/**
 * 委員会の会議記録から、議案ごとの審査記録を取り出す。
 *
 * 委員会は付託された議案を1件ずつ（または関連するものを一括で）議題にし、
 * 当局の課長級が内容を説明し、委員が質疑する。この説明が、市の公開資料の
 * 中で最も具体的に「議案が何をするものか」を語っている。
 *
 * 発言の本文をそのまま公開はしない前提で、AI解説の材料として説明を切り出し、
 * 質疑は発言数という事実のみを数える。
 */
export function extractCommitteeBillReviews(
  text: string
): CommitteeBillReview[] {
  const declarations = [...text.matchAll(AGENDA_DECLARATION)];
  const reviews: CommitteeBillReview[] = [];

  declarations.forEach((declaration, index) => {
    const billNumbers = extractBillNumbers(declaration[1]);
    if (billNumbers.length === 0) return;

    const start = declaration.index ?? 0;
    const end = declarations[index + 1]?.index ?? text.length;
    const segment = text.slice(start, end);

    const { explanation, questionCount } = analyzeSegment(segment);
    // 予算審査のように説明を省略して質疑だけ行う議題もある。
    // 説明も質疑も無いもの（議題の宣告だけ）は審査とみなさない
    if (!explanation && questionCount === 0) return;

    reviews.push({ billNumbers, explanation, questionCount });
  });

  return reviews;
}

function extractBillNumbers(text: string): string[] {
  const numbers: string[] = [];
  for (const match of text.matchAll(new RegExp(BILL_NUMBER_SOURCE, "g"))) {
    const parsed = parseBillNumber(match[0]);
    if (parsed && !numbers.includes(parsed.billNumber)) {
      numbers.push(parsed.billNumber);
    }
  }
  return numbers;
}

/**
 * 議題1件分の発言列から、当局の説明と質疑の回数を取り出す。
 *
 * - 当局（〜課長・〜部長・〜長などの役職名）の発言のうち、質疑が始まる前の
 *   ものを説明とみなす
 * - 「〜委員」の発言を質疑として数える
 */
function analyzeSegment(segment: string): {
  explanation: string;
  questionCount: number;
} {
  const explanationParts: string[] = [];
  let questionCount = 0;
  let inQuestions = false;

  const utterances = segment.split(/\n\n(?=○)/);
  for (const utterance of utterances) {
    const [speakerLine, ...bodyLines] = utterance.split("\n");
    const speaker = speakerLine.match(SPEAKER_LINE)?.[1]?.trim();
    if (!speaker) continue;

    const body = bodyLines.join("\n").trim();

    if (speaker.endsWith("委員") && !speaker.endsWith("委員長")) {
      questionCount += 1;
      inQuestions = true;
      continue;
    }

    if (speaker.endsWith("委員長")) {
      // 「御質疑を伺います」以降は説明ではなく答弁になる
      if (/質疑/.test(body)) inQuestions = true;
      continue;
    }

    // 委員・委員長以外＝当局（課長・部長など）。質疑開始前の発言だけを説明に採る
    if (!inQuestions && body) {
      explanationParts.push(body);
    }
  }

  return {
    explanation: explanationParts.join("\n").trim(),
    questionCount,
  };
}
