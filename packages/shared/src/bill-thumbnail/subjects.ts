/**
 * 議案サムネイルの題材。
 *
 * 議案ごとに写真を用意する代わりに、内容に近い題材の概念画像を当てる。
 * 画像は人物や実在の場所を描かず、物や図面のモチーフだけで構成する。
 * `key` は `web/public/img/bill-thumbnails/<key>.webp` のファイル名と、
 * `bills.thumbnail_key` の値に使う。題材を足したら画像も一緒に足すこと。
 */
export const BILL_THUMBNAIL_SUBJECTS = [
  {
    key: "school-building",
    label: "学校施設の整備・改修",
    description:
      "小中学校の校舎・体育館・プールなど学校施設の新築、改修、設備更新、工事契約",
  },
  {
    key: "school-lunch",
    label: "学校給食",
    description:
      "学校給食（給食センター、給食費、食材、調理場）",
  },
  {
    key: "childcare",
    label: "保育・通園・子育て支援",
    description:
      "保育園・こども園・放課後児童クラブ、通園支援、子育て支援、出産・育児の給付",
  },
  {
    key: "education-general",
    label: "教育全般・教育委員会・いじめ対策",
    description:
      "教育委員会の運営、いじめ対策、就学支援、図書館や生涯学習など教育全般（教育委員の選任は personnel）",
  },
  {
    key: "hospital",
    label: "市立病院・救急医療",
    description:
      "市立病院、夜間救急、医療体制、病院事業会計",
  },
  {
    key: "insurance",
    label: "国民健康保険・介護保険・医療費",
    description:
      "国民健康保険、後期高齢者医療、介護保険の保険料・給付・会計",
  },
  {
    key: "welfare",
    label: "高齢者・障害者福祉",
    description:
      "高齢者福祉、障害者福祉、生活保護、福祉施設、地域福祉",
  },
  {
    key: "road",
    label: "道路・橋・交通",
    description:
      "道路の新設・改良・維持、橋りょう、交通安全、市道の認定・廃止",
  },
  {
    key: "park",
    label: "公園・緑地・スポーツ施設",
    description:
      "公園、緑地、スポーツ施設、運動場、体育館（学校以外）",
  },
  {
    key: "water",
    label: "上下水道",
    description:
      "上水道、下水道、水道料金、浄水場・処理場、水道事業会計",
  },
  {
    key: "housing",
    label: "市営住宅・建築物",
    description:
      "市営住宅、公共建築物の管理、建築基準、空き家対策",
  },
  {
    key: "cemetery",
    label: "墓地・斎場",
    description:
      "墓地、斎場、火葬場",
  },
  {
    key: "city-planning",
    label: "区画整理・都市計画・土地",
    description:
      "土地区画整理、都市計画、用地の取得・処分、市街地整備、地区計画",
  },
  {
    key: "fire",
    label: "消防団・消防設備",
    description:
      "消防団、消防署、消防車両・設備、救急",
  },
  {
    key: "disaster",
    label: "防災・危機管理",
    description:
      "防災、危機管理、避難所、備蓄、災害対策本部、被災者支援",
  },
  {
    key: "river",
    label: "治水・河川・海岸保全",
    description:
      "河川、治水、排水、海岸・港湾の護岸、津波対策の堤防",
  },
  {
    key: "port",
    label: "漁港・水産業",
    description:
      "漁港、水産業、市場、漁業振興",
  },
  {
    key: "tourism",
    label: "観光施設・レクリエーション",
    description:
      "観光施設、観光振興、記念公園、レクリエーション施設、イベント",
  },
  {
    key: "agriculture",
    label: "農林業",
    description:
      "農業、林業、農地、農業振興、鳥獣被害対策",
  },
  {
    key: "business",
    label: "事業者支援・商工業",
    description:
      "商工業、事業者支援、中小企業、産業振興、雇用、商店街",
  },
  {
    key: "budget",
    label: "予算・決算・補正予算",
    description:
      "一般会計・特別会計の予算、補正予算、決算の認定、繰越、基金",
  },
  {
    key: "tax",
    label: "市税・手数料・使用料",
    description:
      "市税、手数料、使用料、税条例の改正、減免",
  },
  {
    key: "personnel",
    label: "人事・選任・同意",
    description:
      "副市長・教育委員・監査委員などの選任や同意、職員の定数・給与・勤務条件、人権擁護委員の推薦",
  },
  {
    key: "council",
    label: "意見書・決議・議会運営",
    description:
      "意見書、決議、議会の運営、議員報酬、政務活動費、委員会",
  },
  {
    key: "contract",
    label: "契約・工事請負・財産の取得",
    description:
      "工事請負契約、物品の取得、財産の取得・処分、指定管理者の指定",
  },
  {
    key: "compensation",
    label: "損害賠償・示談・事故の報告",
    description:
      "損害賠償の額の決定、和解、示談、事故の報告、専決処分の承認（事故関係）",
  },
  {
    key: "petition",
    label: "請願・陳情",
    description:
      "請願、陳情",
  },
  {
    key: "general",
    label: "市政全般（汎用）",
    description:
      "上記のどれにも当てはまらない、または市政全般にまたがる議案",
  },
] as const;

export type BillThumbnailSubject = (typeof BILL_THUMBNAIL_SUBJECTS)[number];
export type BillThumbnailSubjectKey = BillThumbnailSubject["key"];

/** どの題材にも当てはまらない議案に使う。 */
export const DEFAULT_BILL_THUMBNAIL_SUBJECT: BillThumbnailSubjectKey =
  "general";

const SUBJECT_KEYS: ReadonlySet<string> = new Set(
  BILL_THUMBNAIL_SUBJECTS.map((subject) => subject.key),
);

export function isBillThumbnailSubjectKey(
  value: unknown,
): value is BillThumbnailSubjectKey {
  return typeof value === "string" && SUBJECT_KEYS.has(value);
}

/**
 * 分野タグごとの既定の題材。
 *
 * LLM の割り当てがまだ無い議案（取り込み直後など）に、タグから大まかな
 * 題材を当てるための対応。タグは DB のラベルで突き合わせる。
 * 並びは tags の featured_priority 順で、複数タグの議案は先に現れる方を使う。
 */
export const TAG_DEFAULT_SUBJECTS: ReadonlyArray<{
  label: string;
  key: BillThumbnailSubjectKey;
}> = [
  { label: "子育て・教育", key: "education-general" },
  { label: "医療・福祉", key: "welfare" },
  { label: "暮らし・まちづくり", key: "city-planning" },
  { label: "防災・安全", key: "disaster" },
  { label: "産業・観光", key: "business" },
  { label: "行財政・人事", key: "budget" },
];
