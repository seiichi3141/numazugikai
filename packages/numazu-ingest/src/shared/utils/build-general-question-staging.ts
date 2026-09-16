import { createHash } from "node:crypto";
import type { ParsedGeneralQuestionAppearance } from "../../parsers/parse-general-question-pdf";

export type PreviousGeneralQuestionAppearance = {
  appearanceId: string;
  sourceKey: string;
  contentFingerprint: string;
  parsedPayload: ParsedGeneralQuestionAppearance;
};

export type GeneralQuestionStagingRow = {
  sourceKey: string;
  contentFingerprint: string;
  changeKind: "new" | "changed" | "unchanged" | "missing" | "ambiguous";
  matchedAppearanceId: string | null;
  parsedPayload: ParsedGeneralQuestionAppearance;
};

export function fingerprintGeneralQuestionAppearance(
  appearance: ParsedGeneralQuestionAppearance
): string {
  return createHash("sha256").update(JSON.stringify(appearance)).digest("hex");
}

/** 現在の解析結果と前回確定値を比較し、削除せずQA対象の差分として返す。 */
export function buildGeneralQuestionStagingRows(
  appearances: readonly ParsedGeneralQuestionAppearance[],
  previous: readonly PreviousGeneralQuestionAppearance[]
): GeneralQuestionStagingRow[] {
  const previousByKey = new Map(previous.map((row) => [row.sourceKey, row]));
  const keyCounts = new Map<string, number>();
  for (const appearance of appearances) {
    keyCounts.set(
      appearance.sourceKey,
      (keyCounts.get(appearance.sourceKey) ?? 0) + 1
    );
  }

  const handledKeys = new Set<string>();
  const rows: GeneralQuestionStagingRow[] = [];
  for (const appearance of appearances) {
    if (handledKeys.has(appearance.sourceKey)) continue;
    handledKeys.add(appearance.sourceKey);
    const contentFingerprint = fingerprintGeneralQuestionAppearance(appearance);
    const matched = previousByKey.get(appearance.sourceKey);
    previousByKey.delete(appearance.sourceKey);
    rows.push({
      sourceKey: appearance.sourceKey,
      contentFingerprint,
      changeKind:
        (keyCounts.get(appearance.sourceKey) ?? 0) > 1
          ? ("ambiguous" as const)
          : !matched
            ? ("new" as const)
            : matched.contentFingerprint === contentFingerprint
              ? ("unchanged" as const)
              : ("changed" as const),
      matchedAppearanceId: matched?.appearanceId ?? null,
      parsedPayload: appearance,
    });
  }

  for (const missing of previousByKey.values()) {
    rows.push({
      sourceKey: missing.sourceKey,
      contentFingerprint: missing.contentFingerprint,
      changeKind: "missing",
      matchedAppearanceId: missing.appearanceId,
      parsedPayload: missing.parsedPayload,
    });
  }
  return rows;
}
