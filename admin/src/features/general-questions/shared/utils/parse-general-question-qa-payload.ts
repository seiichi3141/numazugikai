import type { GeneralQuestionSourceItem } from "./general-question-summary";

type ParsedItem = {
  sourceKey?: unknown;
  label?: unknown;
  parentSourceKey?: unknown;
};

export function parseGeneralQuestionSourceItems(
  value: unknown
): GeneralQuestionSourceItem[] {
  if (!Array.isArray(value)) return [];

  const sourceKeys = new Set<string>();
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as ParsedItem;
    if (
      typeof item.sourceKey !== "string" ||
      item.sourceKey.trim() === "" ||
      sourceKeys.has(item.sourceKey) ||
      typeof item.label !== "string" ||
      item.label.trim() === ""
    ) {
      return [];
    }
    sourceKeys.add(item.sourceKey);
    return [
      {
        sourceKey: item.sourceKey,
        label: item.label,
        parentSourceKey:
          typeof item.parentSourceKey === "string"
            ? item.parentSourceKey
            : null,
      },
    ];
  });
}

export function parseGeneralQuestionSummaryMap(
  value: unknown
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}
