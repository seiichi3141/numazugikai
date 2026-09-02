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
 * 題材の画像は人物や実在の場所を描かない概念画像で、`public/img/bill-thumbnails/` に置く。
 */

export type BillThumbnailSource = {
  thumbnail_url: string | null;
  thumbnail_key: string | null;
  tags: { label: string }[];
};

export function subjectThumbnailSrc(key: BillThumbnailSubjectKey): string {
  return `/img/bill-thumbnails/${key}.webp`;
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
