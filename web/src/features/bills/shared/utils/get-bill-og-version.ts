/**
 * OGP 画像 URL に付ける版。画像に載る内容のどれかが変わったら変わる。
 *
 * 版が URL に入っていれば画像を長期キャッシュにでき、内容が変わったときは
 * 別 URL になるので SNS 側のキャッシュも自然に切れる。
 *
 * 更新日時だけでは足りない。タグの付け替えや名称変更は議案本体の
 * updated_at を動かさないので、タグの内容も版に含める。
 */
export function getBillOgVersion(bill: {
  updated_at: string;
  bill_content?: { updated_at: string } | null;
  tags?: readonly { id: string; label: string }[];
}): string {
  const timestamps = [bill.updated_at, bill.bill_content?.updated_at]
    .filter((v): v is string => typeof v === "string")
    .map((v) => Date.parse(v))
    .filter((t) => !Number.isNaN(t));
  const newest = Math.max(...timestamps, 0);

  const tagKey = (bill.tags ?? [])
    .map((tag) => `${tag.id}:${tag.label}`)
    .sort()
    .join("|");
  return tagKey ? `${newest}-${shortHash(tagKey)}` : String(newest);
}

/** URL に載せる短い指紋。衝突耐性は要らず、変化が検出できればよい */
function shortHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
