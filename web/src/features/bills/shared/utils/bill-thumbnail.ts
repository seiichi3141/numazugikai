import {
  type BillThumbnailSubjectKey,
  DEFAULT_BILL_THUMBNAIL_SUBJECT,
  isBillThumbnailSubjectKey,
  TAG_DEFAULT_SUBJECTS,
} from "@mirai-gikai/shared/bill-thumbnail/subjects";

/**
 * 議案のサムネイル画像を決める。
 *
 * 優先順は次のとおり。
 * 1. 管理画面からアップロードした画像（thumbnail_url）
 * 2. LLM が内容から決めた題材（thumbnail_key）
 * 3. 分野タグごとの既定の題材（割り当て前の議案向け）
 * 4. 汎用の題材
 * 題材の画像は、地域写真を基にした生成イラストまたは既存の概念画像で、
 * `public/img/bill-thumbnails/` に置く。
 */

export type BillThumbnailSource = {
  thumbnail_url: string | null;
  thumbnail_key: string | null;
  tags: { label: string }[];
};

const SUBJECT_THUMBNAIL_FILENAMES: Partial<
  Record<BillThumbnailSubjectKey, string>
> = {
  port: "port-numazu-v1.webp",
  river: "river-numazu-v1.webp",
  road: "road-numazu-v1.webp",
  tourism: "tourism-numazu-v1.webp",
};

export function subjectThumbnailSrc(key: BillThumbnailSubjectKey): string {
  const filename = SUBJECT_THUMBNAIL_FILENAMES[key] ?? `${key}.webp`;
  return `/img/bill-thumbnails/${filename}`;
}

export function resolveBillThumbnail(bill: BillThumbnailSource): string {
  if (bill.thumbnail_url) {
    return bill.thumbnail_url;
  }
  if (isBillThumbnailSubjectKey(bill.thumbnail_key)) {
    return subjectThumbnailSrc(bill.thumbnail_key);
  }
  const labels = new Set(bill.tags.map((tag) => tag.label));
  const matched = TAG_DEFAULT_SUBJECTS.find(({ label }) => labels.has(label));
  return subjectThumbnailSrc(matched?.key ?? DEFAULT_BILL_THUMBNAIL_SUBJECT);
}
