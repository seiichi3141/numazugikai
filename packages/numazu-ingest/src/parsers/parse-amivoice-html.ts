import { toHalfWidthDigits } from "./normalize-wareki";

/**
 * 沼津市議会の会議記録検索システム（AmiVoice）のページを解析する。
 *
 * このシステムには議会中継（DiscussVision）より充実した会議記録がある。
 * - 本会議: 会議中継より公開が早い（直近の定例会も読める）
 * - 委員会: 平成27年以降の全委員会。議案ごとの当局説明と委員の質疑が載る
 *
 * 沼津市は個人情報保護のため発言の一部を伏せて「会議記録」として公開しており、
 * 正式な「会議録」とは異なる。利用側でその旨を表示すること。
 */

/** 会期・委員会の一覧の1行 */
export type AmivoiceSession = {
  /** 会期は "m20260513_01.vcsm"、委員会は "---3" のような固定コード */
  vcsm: string;
  /** 例: "令和8年第13回定例会" / "民生病院教育委員会" */
  label: string;
  kind: "session" | "committee";
};

/** 会議（1日分）の1行 */
export type AmivoiceMeeting = {
  /** 会議記録の識別子（例: "v20260513_02.vcsv"） */
  vcsv: string;
  /** ISO 8601 の開催日 */
  date: string;
  /** 例: "令和8年第13回定例会（第1日）" */
  label: string;
};

/** トップページから会期と委員会の一覧を取り出す。 */
export function parseAmivoiceSessionList(html: string): AmivoiceSession[] {
  const sessions: AmivoiceSession[] = [];
  const pattern =
    /search\.exe\?vcsm=([^&"']+)&(?:amp;)?[^"']*process=list[^"']*["'][^>]*>([^<]+)/g;

  for (const match of html.matchAll(pattern)) {
    const vcsm = match[1].trim();
    const label = decodeEntities(match[2]).trim();
    if (!vcsm || !label) continue;
    sessions.push({
      vcsm,
      label,
      kind: vcsm.startsWith("---") ? "committee" : "session",
    });
  }
  return sessions;
}

/** 会期・委員会のページから、会議（1日分）の一覧を取り出す。 */
export function parseAmivoiceMeetingList(html: string): AmivoiceMeeting[] {
  const meetings: AmivoiceMeeting[] = [];
  const pattern =
    /<td>(\d{4})\/(\d{2})\/(\d{2})[^<]*<\/td>\s*<td><a[^>]*DataSubmit4\('search\.exe\?vcsv=([^&']+)&process=disp_base'\);?"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(pattern)) {
    meetings.push({
      vcsv: match[4].trim(),
      date: `${match[1]}-${match[2]}-${match[3]}`,
      label: decodeEntities(match[5]).trim(),
    });
  }
  return meetings;
}

/**
 * 会議記録の本文ページ（disp_right フレーム）を、発言単位のテキストに直す。
 *
 * 各発言は `<div class="sub2"><b>○発言者</b> … 本文 …</div>` の形。
 * 既存の会議録パーサ（parse-minutes.ts）がそのまま使えるよう、
 * `○発言者\n本文` を発言ごとに連ねた形式で返す。
 */
export function amivoiceHtmlToText(html: string): string {
  const utterances: string[] = [];
  const blockPattern = /<div class="sub2">([\s\S]*?)<\/div>/g;

  for (const match of html.matchAll(blockPattern)) {
    const block = match[1];
    const speaker = block.match(/<b>\s*(○[^<]+)<\/b>/);
    if (!speaker) continue;

    const body = decodeEntities(
      block
        .replace(/<b>\s*○[^<]+<\/b>/, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
    )
      .replace(/[ \t]+/g, " ")
      .replace(/\n[\s　]+/g, "\n")
      .trim();

    utterances.push(`${decodeEntities(speaker[1]).trim()}\n${body}`);
  }

  return utterances.join("\n\n");
}

/**
 * "令和8年第13回定例会" から西暦年と回次を取る。
 * 会期でないラベル（委員会など）は null。
 */
export function parseAmivoiceSessionLabel(
  label: string
): { year: number; sessionNumber: number } | null {
  const normalized = toHalfWidthDigits(label);
  const matched = normalized.match(
    /(令和|平成|昭和)\s*(\d{1,2}|元)\s*年第\s*(\d{1,3})\s*回(定例会|臨時会)/
  );
  if (!matched) return null;

  const base = { 令和: 2019, 平成: 1989, 昭和: 1926 }[matched[1]];
  if (base === undefined) return null;
  const eraYear = matched[2] === "元" ? 1 : Number(matched[2]);
  return {
    year: base + eraYear - 1,
    sessionNumber: Number(matched[3]),
  };
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
