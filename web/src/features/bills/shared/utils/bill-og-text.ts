import { formatDateWithDots } from "@/lib/utils/date";
import { truncateText } from "@/lib/utils/truncate-text";
import { type BillStatusEnum, getBillStatusLabel } from "../types";

/** 見出しは2行まで。省略記号3文字と合わせて最大44文字にする */
const TITLE_MAX_LENGTH = 41;
/** 要約は2行まで。28px なら 1行 30文字前後 */
const SUMMARY_MAX_LENGTH = 70;
/** 新しいブランドレイアウトの下段に収まる2つまで */
const TAGS_MAX = 2;
/** タグ名は管理画面で自由に付けられる。長いものは切って行に収める */
const TAG_LABEL_MAX_LENGTH = 9;

/** DB の行と同じ形で受ける。無い値は null */
export type BillOgSource = {
  name: string;
  /** わかりやすいタイトル。無ければ正式名称を使う */
  contentTitle: string | null;
  /** 解説の要約。見出しだけでは何の議案か伝わらないときの補足 */
  summary: string | null;
  billNumber: string | null;
  status: BillStatusEnum;
  submittedDate: string | null;
  tags: readonly { label: string }[];
};

export type BillOgText = {
  title: string;
  /** 無ければ空文字。画像側はそのまま描き、空でも枠の高さを保つ */
  summary: string;
  /** 議案番号・提出日など、見出しの上に小さく出すもの */
  meta: string[];
  status: string;
  tags: string[];
};

/**
 * 議案の OGP 画像に載せる文言を組み立てる。
 *
 * 見出しはわかりやすいタイトルを優先する。正式名称は「沼津市○○条例の一部を
 * 改正する条例について」のように長く、画像に収まらないうえに内容が伝わらない。
 */
export function buildBillOgText(bill: BillOgSource): BillOgText {
  const rawTitle = bill.contentTitle?.trim() || bill.name;
  const meta: string[] = [];
  if (bill.billNumber) meta.push(bill.billNumber);
  const submitted = bill.submittedDate
    ? formatDateWithDots(bill.submittedDate)
    : "";
  if (submitted) meta.push(`${submitted} 提出`);

  return {
    title: truncateText(rawTitle, TITLE_MAX_LENGTH),
    // 画像では改行が効かず行頭に空白が残るので、1つの空白に畳む
    summary: truncateText(
      (bill.summary ?? "").replace(/\s+/g, " ").trim(),
      SUMMARY_MAX_LENGTH
    ),
    meta,
    status: getBillStatusLabel(bill.status),
    tags: bill.tags
      .slice(0, TAGS_MAX)
      .map((tag) => truncateText(tag.label, TAG_LABEL_MAX_LENGTH)),
  };
}
