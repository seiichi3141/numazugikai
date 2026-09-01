import type { Database } from "@mirai-gikai/supabase";

type TagInsert = Database["public"]["Tables"]["tags"]["Insert"];
type BillsTagsInsert = Database["public"]["Tables"]["bills_tags"]["Insert"];

/**
 * 沼津市議会の議案に付けるタグ。
 *
 * 条例案・予算案・人事案件といった「議案の種別」は bills.category が持っているため、
 * タグは「暮らしのどの分野の話か」というテーマの切り口で分類する。
 * featured_priority を持つタグが議案一覧の絞り込みに並ぶ。
 */
export const tags: TagInsert[] = [
  {
    label: "子育て・教育",
    description:
      "学校施設、学校給食、保育・通園支援、いじめ対策など子どもと教育に関する議案",
    featured_priority: 1,
  },
  {
    label: "医療・福祉",
    description:
      "市立病院、夜間救急、国民健康保険、介護保険、高齢者・障害者福祉に関する議案",
    featured_priority: 2,
  },
  {
    label: "暮らし・まちづくり",
    description:
      "道路、公園、上下水道、市営住宅、墓地・斎場など生活基盤の整備に関する議案",
    featured_priority: 3,
  },
  {
    label: "防災・安全",
    description: "消防団、危機管理、治水、災害への備えに関する議案",
    featured_priority: 4,
  },
  {
    label: "産業・観光",
    description:
      "沼津港、御用邸記念公園、西浦・戸田の観光施設、農林水産業、事業者支援に関する議案",
    featured_priority: 5,
  },
  {
    label: "行財政・人事",
    description:
      "予算・決算、市税・手数料、職員給与、人事案件など市の行財政運営に関する議案",
    featured_priority: 6,
  },
];

/**
 * 議案名に含まれる語からタグを推定するルール。
 *
 * 取り込み済みの実在議案にタグを付けるためのもので、判定は議案名の文字列だけに
 * 依存する（人手の分類ではない）。どのルールにも当たらない議案はタグなしになる。
 */
const TAG_KEYWORD_RULES: { label: string; keywords: string[] }[] = [
  {
    label: "子育て・教育",
    keywords: [
      "学校",
      "小学校",
      "中学校",
      "高等学校",
      "給食",
      "教育",
      "児童",
      "生徒",
      "乳児",
      "保育",
      "いじめ",
      "通園",
    ],
  },
  {
    label: "医療・福祉",
    keywords: [
      "病院",
      "医療",
      "救急",
      "国民健康保険",
      "介護",
      "高齢者",
      "後期高齢者",
      "福祉",
      "障害",
      "人権擁護",
    ],
  },
  {
    label: "暮らし・まちづくり",
    keywords: [
      "道路",
      "市道",
      "公園",
      "下水道",
      "給水",
      "水道",
      "住宅",
      "団地",
      "墓地",
      "斎場",
      "都市計画",
      "区画整理",
      "建築",
      "駐車",
      "橋",
      "中間処理",
      "照明",
      "字の区域",
      "土地",
      "工事",
      "文化センター",
      "地区センター",
      "プラザ",
    ],
  },
  {
    label: "防災・安全",
    keywords: ["消防", "防災", "危機管理", "火入れ", "貯留池", "雨水"],
  },
  {
    label: "産業・観光",
    keywords: [
      "観光",
      "御用邸",
      "海浜",
      "戸田",
      "西浦",
      "沼津港",
      "水門",
      "農業",
      "農地",
      "森",
      "土地改良",
      "事業者",
      "物価高騰",
      "就業",
      "活性化",
    ],
  },
  {
    label: "行財政・人事",
    keywords: [
      "予算",
      "決算",
      "会計",
      "補正",
      "税",
      "手数料",
      "給与",
      "報酬",
      "手当",
      "職員",
      "議員",
      "事務分掌",
      "行政手続",
      "印鑑",
      "監査",
      "選任",
      "任命",
      "推薦",
      "同意",
      "選挙",
      "公平委員会",
      "定数",
    ],
  },
];

/**
 * 取り込み済みの議案にタグを紐づける。
 * ルールに当たらない議案は結果に含まれない（タグなしのままになる）。
 */
export function createBillsTags(
  insertedBills: { id: string; name: string }[],
  insertedTags: { id: string; label: string }[]
): Omit<BillsTagsInsert, "id" | "created_at">[] {
  const tagIdByLabel = new Map(insertedTags.map((t) => [t.label, t.id]));
  const billsTags: Omit<BillsTagsInsert, "id" | "created_at">[] = [];

  for (const bill of insertedBills) {
    for (const rule of TAG_KEYWORD_RULES) {
      const tagId = tagIdByLabel.get(rule.label);
      if (!tagId) continue;
      if (!rule.keywords.some((keyword) => bill.name.includes(keyword))) {
        continue;
      }
      billsTags.push({ bill_id: bill.id, tag_id: tagId });
    }
  }

  return billsTags;
}
