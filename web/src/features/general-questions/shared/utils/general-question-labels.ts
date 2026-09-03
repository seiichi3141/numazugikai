const labels: Record<string, string> = {
  representative: "代表質問",
  personal: "個人質問",
  other: "その他",
  unknown: "未確認",
  all_at_once: "一括質問一括答弁方式",
  one_by_one: "一問一答方式",
  combined: "併用方式",
  mayor: "市長",
  deputy_mayor: "副市長",
  superintendent: "教育長",
  department_head: "部局長",
  division_head: "課・室長",
  administration_other: "その他の行政機関役職",
  collected: "取得・確認済み",
  partial: "一部取得",
  uncollected: "未取得",
  source_not_published: "公式資料未公開",
  source_unavailable: "公式資料を取得できません",
  error: "解析エラー",
  held: "一般質問あり",
  not_held: "公式資料で実施なしを確認",
  not_applicable: "対象外",
  present: "記録あり",
  absent: "記録なし",
  general_question_pdf: "一般質問資料（PDF）",
  meeting_record: "会議録",
};

export function generalQuestionLabel(value: string): string {
  return labels[value] ?? value;
}
