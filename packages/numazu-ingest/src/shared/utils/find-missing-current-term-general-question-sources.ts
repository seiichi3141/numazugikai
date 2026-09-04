import { basename } from "node:path";
import { getGeneralQuestionCurrentTermSources } from "../general-question-current-term-sources";

export function findMissingCurrentTermGeneralQuestionSources(
  term: number,
  sourceUrls: readonly string[]
): string[] {
  if (term !== 25) return [];
  const availableFileNames = new Set(
    sourceUrls.map((url) => basename(new URL(url).pathname))
  );
  return getGeneralQuestionCurrentTermSources()
    .map((source) => source.fileName)
    .filter((fileName) => !availableFileNames.has(fileName));
}
