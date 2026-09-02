/**
 * 議案のサムネイル画像を決める。
 *
 * 管理画面から画像がアップロードされていればそれを使い、無ければ分野タグに
 * 応じた生成イラストを当てる。沼津版は議案ごとの写真を用意しない前提なので、
 * ほぼ全ての議案がこのフォールバックで表示される。
 */

export type BillThumbnailSource = {
  thumbnail_url: string | null;
  tags: { label: string }[];
};

/**
 * 分野タグごとのフォールバック画像。
 * 配列の並びがそのまま優先順位で、複数タグの議案は先に現れる方を使う。
 * タグは DB のラベルで突き合わせるため、タグ名を変えたらここも更新すること。
 */
export const TAG_THUMBNAILS: ReadonlyArray<{ label: string; src: string }> = [
  { label: "子育て・教育", src: "/img/bill-thumbnails/education.webp" },
  { label: "医療・福祉", src: "/img/bill-thumbnails/welfare.webp" },
  { label: "暮らし・まちづくり", src: "/img/bill-thumbnails/living.webp" },
  { label: "防災・安全", src: "/img/bill-thumbnails/safety.webp" },
  { label: "産業・観光", src: "/img/bill-thumbnails/industry.webp" },
  { label: "行財政・人事", src: "/img/bill-thumbnails/governance.webp" },
];

/** どのタグにも当たらない議案（タグ未設定など）に使う画像。 */
export const DEFAULT_BILL_THUMBNAIL = "/img/bill-thumbnails/general.webp";

export function resolveBillThumbnail(bill: BillThumbnailSource): string {
  if (bill.thumbnail_url) {
    return bill.thumbnail_url;
  }
  const labels = new Set(bill.tags.map((tag) => tag.label));
  const matched = TAG_THUMBNAILS.find(({ label }) => labels.has(label));
  return matched?.src ?? DEFAULT_BILL_THUMBNAIL;
}
