import type { ParsedGeneralQuestionAppearance } from "./parse-general-question-pdf";

type Utterance = {
  speaker: string;
  body: string;
};

function splitUtterances(text: string): Utterance[] {
  return [...text.matchAll(/^○([^\n]+)\n([\s\S]*?)(?=\n\n○|$)/gm)].map(
    (match) => ({ speaker: match[1].trim(), body: match[2].trim() })
  );
}

function answererRole(speaker: string): string | null {
  if (/^(?:議長|副議長|[0-9０-９]+番議員)/.test(speaker)) return null;
  const role = speaker
    .split(/[（(]/)[0]
    .replace(/[\s　]+/g, "")
    .trim();
  return role || null;
}

/**
 * AmiVoice本文を処理中だけ走査し、一般質問区間の登壇枠と答弁者役職を抽出する。
 * 発言本文や質問項目本文は戻り値へ含めず、永続化しない。
 */
export function parseGeneralQuestionMinutes(params: {
  text: string;
  heldOn: string;
  sourceKeyPrefix: string;
}): ParsedGeneralQuestionAppearance[] {
  const appearances: ParsedGeneralQuestionAppearance[] = [];
  const seenSpeakers = new Set<string>();
  let inGeneralQuestions = false;
  let current: ParsedGeneralQuestionAppearance | null = null;

  for (const utterance of splitUtterances(params.text)) {
    if (
      /^議長/.test(utterance.speaker) &&
      /(?:日程第\d+\s*)?一般質問を行います/.test(utterance.body)
    ) {
      inGeneralQuestions = true;
      continue;
    }
    if (
      inGeneralQuestions &&
      /^議長/.test(utterance.speaker) &&
      /一般質問(?:を|は).*終わ/.test(utterance.body)
    ) {
      inGeneralQuestions = false;
      current = null;
      continue;
    }
    if (!inGeneralQuestions) continue;

    const councilMember = utterance.speaker.match(
      /^([0-9０-９]+)番議員[（(]([^）)]+)[）)]$/
    );
    if (councilMember) {
      const speakerName = councilMember[2].replace(/[\s　]+/g, "");
      if (seenSpeakers.has(speakerName)) continue;
      seenSpeakers.add(speakerName);
      const questionOrder = appearances.length + 1;
      current = {
        sourceKey: `${params.sourceKeyPrefix}:appearance-${questionOrder}`,
        speakerName,
        seatNumber: Number(
          councilMember[1].replace(/[０-９]/g, (digit) =>
            String(digit.charCodeAt(0) - "０".charCodeAt(0))
          )
        ),
        questionOrder,
        questionKind: /代表質問/.test(utterance.body)
          ? "representative"
          : "unknown",
        deliveryMethod: "unknown",
        heldOn: params.heldOn,
        items: [],
        answerers: [],
      };
      appearances.push(current);
      continue;
    }
    const role = current ? answererRole(utterance.speaker) : null;
    if (role && !current?.answerers.includes(role)) {
      current?.answerers.push(role);
    }
  }
  return appearances;
}
