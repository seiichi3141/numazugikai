/**
 * DBのenum値を、プロンプトに渡す日本語ラベルに直す。
 *
 * web/admin にも同じラベルがあるが、そちらは React に依存しているため
 * ここでは独立して持つ。値が増えたときに取りこぼすと `null` になり、
 * プロンプトからその行が消えるだけで誤情報にはならない。
 */

const CATEGORY_LABELS: Record<string, string> = {
  ordinance: "条例",
  budget: "予算",
  settlement: "決算",
  contract: "契約・財産",
  provisional_approval: "専決承認",
  report: "報告",
  personnel: "人事",
  opinion_paper: "意見書・決議",
  petition: "請願・陳情",
  other: "その他",
};

const SUBMITTER_LABELS: Record<string, string> = {
  mayor: "市長",
  member: "議員",
  committee: "委員会",
  citizen: "市民",
};

const DECISION_LABELS: Record<string, string> = {
  passed: "可決",
  rejected: "否決",
  consented: "同意",
  approved: "承認",
  certified: "認定",
  adopted: "採択",
  not_adopted: "不採択",
  continued: "継続審査",
  withdrawn: "撤回",
  reported: "報告",
};

export function toCategoryLabel(value: string | null): string | null {
  return value ? (CATEGORY_LABELS[value] ?? null) : null;
}

export function toSubmitterLabel(value: string | null): string | null {
  return value ? (SUBMITTER_LABELS[value] ?? null) : null;
}

/**
 * 議決結果のラベル。まだ議決されていない段階（提出・委員会審査中・準備中）は
 * null を返し、プロンプトに議決の行を出さない。
 */
export function toDecisionLabel(status: string | null): string | null {
  return status ? (DECISION_LABELS[status] ?? null) : null;
}
