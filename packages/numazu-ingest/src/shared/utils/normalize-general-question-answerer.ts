export type GeneralQuestionRoleGroup =
  | "mayor"
  | "deputy_mayor"
  | "superintendent"
  | "department_head"
  | "division_head"
  | "administration_other"
  | "unknown";

export type NormalizedGeneralQuestionAnswerer = {
  roleDisplayName: string;
  roleGroup: GeneralQuestionRoleGroup;
};

/** 公式PDFの役職表記を、集計に使う限定的な役職群へ正規化する。 */
export function normalizeGeneralQuestionAnswerer(
  rawRole: string
): NormalizedGeneralQuestionAnswerer {
  const roleDisplayName = rawRole.replace(/[\s　]+/g, "").trim();
  let roleGroup: GeneralQuestionRoleGroup = "unknown";
  if (/副市長/.test(roleDisplayName)) roleGroup = "deputy_mayor";
  else if (/市長/.test(roleDisplayName)) roleGroup = "mayor";
  else if (/教育長/.test(roleDisplayName)) roleGroup = "superintendent";
  else if (/(部長|局長|病院長)$/.test(roleDisplayName))
    roleGroup = "department_head";
  else if (/(課長|室長)$/.test(roleDisplayName)) roleGroup = "division_head";
  else if (/(委員長|代表監査委員|企業管理者)$/.test(roleDisplayName))
    roleGroup = "administration_other";

  return { roleDisplayName, roleGroup };
}
